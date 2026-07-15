import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Provision real Supabase auth accounts for the switch away from MOCK_AUTH.
//
// Credentials are read from the environment — NEVER hardcode the service_role
// key (it bypasses RLS). Run with, e.g.:
//
//   SUPABASE_URL=https://<project>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
//   ADMIN_PASSWORD='<strong-password>' \
//   node scripts/setup-auth-users.mjs
//
// For each user this ensures: an auth.users account, a profile assigned to
// COMPANY_ID, the company super_user role, and (for the Enura admins) an
// enura_admins row so they can reach the /platform console under real auth.
// ---------------------------------------------------------------------------

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PASSWORD = process.env.ADMIN_PASSWORD
const COMPANY_ID =
  process.env.DEV_DEFAULT_COMPANY_ID ?? '00000000-0000-0000-0000-000000000001'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Set them in the environment before running.',
  )
  process.exit(1)
}
if (!PASSWORD || PASSWORD.length < 12) {
  console.error('Set ADMIN_PASSWORD to a strong password (>= 12 chars) before running.')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// isEnuraAdmin mirrors the KNOWN_USERS list in (auth)/login/actions.ts so the
// same people keep /platform access after MOCK_AUTH is disabled.
const USERS = [
  { email: 's.vogel@alpen-energie.ch',  firstName: 'Sarah',   lastName: 'Vogel',  isEnuraAdmin: true },
  { email: 'm.krings@alpen-energie.ch', firstName: 'Michael', lastName: 'Krings', isEnuraAdmin: true },
  { email: 'h.janke@alpen-energie.ch',  firstName: 'Holger',  lastName: 'Janke',  isEnuraAdmin: true },
  { email: 'n.janke@alpen-energie.ch',  firstName: 'Nicos',   lastName: 'Janke',  isEnuraAdmin: true },
]

async function main() {
  // 1. Ensure a super_user role exists for the default company
  console.log('--- Checking/creating super_user role ---')
  let { data: existingRole } = await db
    .from('roles')
    .select('id')
    .eq('company_id', COMPANY_ID)
    .eq('key', 'super_user')
    .maybeSingle()

  if (!existingRole) {
    const { data: newRole, error: roleErr } = await db
      .from('roles')
      .insert({
        company_id: COMPANY_ID,
        key: 'super_user',
        label: 'Super User',
        description: 'Full access to all modules',
        is_system: true,
      })
      .select('id')
      .single()
    if (roleErr) { console.error('  Failed to create role:', roleErr.message); return }
    existingRole = newRole
    console.log(`  Created super_user role: ${existingRole.id}`)
  } else {
    console.log(`  super_user role exists: ${existingRole.id}`)
  }

  const roleId = existingRole.id

  // 2. Create auth users + profiles + role links + enura_admins
  for (const u of USERS) {
    console.log(`\n--- ${u.email} ---`)

    const { data: existingUsers } = await db.auth.admin.listUsers()
    const existing = existingUsers?.users?.find((usr) => usr.email === u.email)

    let userId
    if (existing) {
      console.log(`  Auth user exists: ${existing.id}`)
      const { error: updateErr } = await db.auth.admin.updateUserById(existing.id, {
        password: PASSWORD,
        email_confirm: true,
      })
      if (updateErr) console.error('  Failed to update password:', updateErr.message)
      else console.log('  Password updated')
      userId = existing.id
    } else {
      const { data: newUser, error: createErr } = await db.auth.admin.createUser({
        email: u.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { first_name: u.firstName, last_name: u.lastName },
      })
      if (createErr) {
        console.error('  Failed to create auth user:', createErr.message)
        continue
      }
      userId = newUser.user.id
      console.log(`  Created auth user: ${userId}`)
    }

    // Profile (assigned to the default company)
    const { error: profileErr } = await db
      .from('profiles')
      .upsert(
        {
          id: userId,
          company_id: COMPANY_ID,
          first_name: u.firstName,
          last_name: u.lastName,
          locale: 'de-CH',
          must_reset_password: false,
          is_active: true,
        },
        { onConflict: 'id' },
      )
    if (profileErr) console.error('  Profile upsert failed:', profileErr.message)
    else console.log('  Profile upserted')

    // Company super_user role
    const { error: linkErr } = await db
      .from('profile_roles')
      .upsert({ profile_id: userId, role_id: roleId }, { onConflict: 'profile_id,role_id' })
    if (linkErr) console.error('  Role link failed:', linkErr.message)
    else console.log('  Linked to super_user role')

    // Enura Group super-admin (needed for /platform under real auth)
    if (u.isEnuraAdmin) {
      const { error: enuraErr } = await db
        .from('enura_admins')
        .upsert({ profile_id: userId }, { onConflict: 'profile_id' })
      if (enuraErr) console.error('  enura_admins upsert failed:', enuraErr.message)
      else console.log('  Marked as Enura admin')
    }
  }

  console.log('\n=== DONE ===')
  console.log('All listed users can now sign in with the ADMIN_PASSWORD you provided.')
  console.log('Next: set MOCK_AUTH=false on the web deployment, redeploy, and verify login.')
}

main().catch(console.error)
