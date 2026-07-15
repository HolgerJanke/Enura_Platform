# Switching off MOCK_AUTH (enable real Supabase auth)

While `MOCK_AUTH` is active (the default — it's off only when `MOCK_AUTH=false`),
login **ignores the password and the database roles**: any email signs in and is
treated as a super_user + Enura admin. Turning it off makes real accounts,
passwords, and `profile_roles`/`enura_admins` actually apply.

> ⚠️ **Lockout risk.** Once `MOCK_AUTH=false`, **only users with a real Supabase
> auth account can log in.** Anyone without one — including whoever flips the
> switch — is locked out until an account is provisioned. Do the steps in order.

## 0. Prerequisite: rotate the exposed service_role key

`scripts/setup-auth-users.mjs` previously **hardcoded the production
`service_role` key**. Treat that key as compromised: rotate it in the Supabase
dashboard (Settings → API → "Reset service_role key") and update
`SUPABASE_SERVICE_ROLE_KEY` in Vercel (both projects) and any local `.env`
before continuing. The service_role key bypasses RLS entirely.

## 1. Provision real accounts (do this FIRST, while still on mock auth)

Run the hardened provisioning script with credentials from the environment
(never commit them). It creates auth users + profiles + the `super_user` role,
and marks the Enura admins in `enura_admins` so they keep `/platform` access.

```bash
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<rotated_service_role_key> \
ADMIN_PASSWORD='<strong-shared-password>' \
node scripts/setup-auth-users.mjs
```

Edit the `USERS` list in the script for the real people who need access. Every
Enura admin (`isEnuraAdmin: true`) gets an `enura_admins` row; everyone else is
a company super_user only.

## 2. Verify the accounts exist

In the Supabase dashboard (or via SQL):

- `auth.users` has the emails you provisioned.
- `public.profiles` has a matching row per user (`company_id` set).
- `public.enura_admins` has a row for each admin who needs `/platform`.
- `public.profile_roles` links each user to `super_user`.

## 3. Flip the env var on Vercel

Set `MOCK_AUTH=false` for **both** projects (Production scope), then redeploy:

- `enura-platform`
- `enura-platform-web`

(Leave Preview on mock auth if you still want frictionless preview logins.)

## 4. Verify login end-to-end

1. Sign in with a provisioned email + `ADMIN_PASSWORD`.
2. Confirm a company super_user lands on the dashboard and only sees permitted
   modules (roles now come from `profile_roles`).
3. Confirm an Enura admin can open `/platform`.
4. Confirm an email **without** an account is rejected (expected).
5. Check the first-login flow: `must_reset_password` → `/reset-password`, then
   `/enrol-2fa` if `totp_enabled = false`. The script sets
   `must_reset_password = false` for a frictionless first switch; set it to
   `true` if you want to force resets.

## 5. Rollback

If anything goes wrong, set `MOCK_AUTH=true` (or delete the var) on both
projects and redeploy. Mock auth returns immediately — no data changes needed.

## Notes

- Real role enforcement depends on `profile_roles` and the per-company `roles`
  seeded by `trg_seed_company_roles`. Assign roles via the holding detail page
  (`/platform/holdings/[id]` → Benutzer & Rollen) or company Settings → Users.
- Invitation emails are still a TODO (Resend). Until then, hand over the temp
  password shown after inviting a user.
