-- 047: Custom access-token hook — inject gate state into every issued JWT.
--
-- Enables the "full JWT-claims" path for the auth middleware: once this hook is
-- registered (Dashboard → Authentication → Hooks → Custom Access Token) and the
-- project is on asymmetric JWT signing keys, the middleware verifies tokens
-- locally and reads the gate state straight off the token — no per-request
-- profiles lookup. See docs/auth-middleware-graduation.md.
--
-- Until it is registered, the middleware transparently falls back to a fresh DB
-- read, so shipping this migration alone changes nothing at runtime.

create or replace function public.add_gate_claims(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb := coalesce(event->'claims', '{}'::jsonb);
  p record;
begin
  select must_reset_password, totp_enabled, company_id, holding_id
    into p
  from public.profiles
  where id = (event->>'user_id')::uuid;

  if found then
    claims := jsonb_set(claims, '{must_reset_password}', to_jsonb(coalesce(p.must_reset_password, false)));
    claims := jsonb_set(claims, '{totp_enabled}',        to_jsonb(coalesce(p.totp_enabled, false)));
    claims := jsonb_set(claims, '{company_id}',          coalesce(to_jsonb(p.company_id), 'null'::jsonb));
    claims := jsonb_set(claims, '{holding_id}',          coalesce(to_jsonb(p.holding_id), 'null'::jsonb));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- The Auth server (supabase_auth_admin) executes the hook; grant it access and
-- keep the function off the public API surface.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.add_gate_claims(jsonb) to supabase_auth_admin;
revoke execute on function public.add_gate_claims(jsonb) from authenticated, anon, public;

-- The hook reads profiles for the user being issued a token.
grant select on public.profiles to supabase_auth_admin;
