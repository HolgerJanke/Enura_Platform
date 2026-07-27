# Auth-in-middleware: interim → full JWT-claims

The middleware now enforces the reset-password / 2FA gate (CLAUDE.md §4.2, backlog 1.4) and aligns
branding + subdomain with the signed-in user's own company (backlog 1.5), and forwards the verified
user id to `getSession()` so auth work happens once, not twice (backlog 4.2).

## What ships today (interim)

Per request, `apps/web/src/middleware.ts`:

1. **Verifies the session** with `supabase.auth.getUser()` (one network call).
2. **Gate (1.4):** reads `must_reset_password, totp_enabled, company_id` from `profiles` — **uncached, always fresh** — and redirects a signed-in user to `/reset-password` or `/enrol-2fa` before the page renders. The `(dashboard)` layout gate (1.3) stays as a backstop.
3. **Branding (1.5):** resolves the company's branding via anon REST, **cached per-isolate for 5 min** (cosmetic only, never a security boundary). Signed-in users always get their **own** company's branding; on a foreign tenant subdomain they are redirected to their own subdomain; anonymous visitors keep the subdomain's branding.
4. **Header hygiene:** deletes any inbound `x-auth-user-id` on **every** path (incl. the `/api/*` and static short-circuits) so a client can't forge it, then sets the verified id. `getSession()` trusts that header and skips its own `auth.getUser()`.

Cost per navigation ≈ `getUser` (network) + one tiny indexed `profiles` read + branding (cache hit = 0). Correct today with no Supabase config changes. Because the gate reads the DB, a completed reset / 2FA takes effect on the **next** request — no token refresh required.

## Graduating to full JWT-claims (zero DB round trips on the hot path)

> **Status:** the code is already landed and self-activating. `middleware.ts` calls `getClaims()`
> and uses the gate claims when the token carries them, else falls back to the DB read; the
> `reset-password` / `enrol-2fa` actions already call `refreshSession()`; the hook lives in
> `supabase/migrations/047_access_token_gate_claims.sql`. **All that remains is the two Supabase
> dashboard actions below** — no further code changes are needed.

Do them in this order.

### 1. Rotate to asymmetric JWT signing keys (dashboard)
Supabase Dashboard → Project Settings → **JWT Keys** → migrate from the legacy shared secret to an
**asymmetric** key (ECC/RS256). This lets `getClaims()` verify tokens **locally** via JWKS with no
call to the Auth server. (Until this is done, `getClaims()` transparently falls back to a network
verify, so the code below is safe to land first.)

### 2. Add a custom access-token hook (migration + dashboard)
Create the hook function, then register it in Dashboard → Authentication → **Hooks** → *Custom Access
Token*. It injects the gate state into every issued token:

```sql
-- supabase/migrations/0XX_access_token_claims.sql
create or replace function public.add_gate_claims(event jsonb)
returns jsonb language plpgsql stable as $$
declare
  claims jsonb := event->'claims';
  p record;
begin
  select must_reset_password, totp_enabled, company_id, holding_id
    into p
  from public.profiles
  where id = (event->>'user_id')::uuid;

  if found then
    claims := jsonb_set(claims, '{must_reset_password}', to_jsonb(coalesce(p.must_reset_password,false)));
    claims := jsonb_set(claims, '{totp_enabled}',        to_jsonb(coalesce(p.totp_enabled,false)));
    claims := jsonb_set(claims, '{company_id}',          coalesce(to_jsonb(p.company_id), 'null'::jsonb));
    claims := jsonb_set(claims, '{holding_id}',          coalesce(to_jsonb(p.holding_id), 'null'::jsonb));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.add_gate_claims to supabase_auth_admin;
```

### 3. Middleware: verify locally, gate from claims (code)
Replace the `getUser()` + `profiles` read with:

```ts
const { data } = await supabase.auth.getClaims()   // local verify once JWKS is cached
const claims = data?.claims
const userId = (claims?.sub as string) ?? null
// gate + company straight off the token — no DB query:
const gateProfile = claims && {
  must_reset_password: Boolean(claims.must_reset_password),
  totp_enabled: Boolean(claims.totp_enabled),
  company_id: (claims.company_id as string | null) ?? null,
}
```

Everything downstream (gate redirect, 1.5 branding, header forwarding) is unchanged.

### 4. Refresh the token when gate state flips (code)
Because claims are baked into the token, a completed reset / 2FA must issue a fresh token or the old
claim lingers until the token's natural refresh. After the DB write, add:

- `apps/web/src/app/(auth)/reset-password/actions.ts` — after `must_reset_password = false`
- `apps/web/src/app/(auth)/enrol-2fa/actions.ts` — after `totp_enabled = true`

```ts
await supabase.auth.refreshSession()   // re-runs the hook, new token carries the updated claim
```

### Result
Hot path becomes: local JWT verify (< 1 ms, no network) + gate-from-claims (0 queries) + branding
(cache hit). No per-request Auth-server or `profiles` round trip.
