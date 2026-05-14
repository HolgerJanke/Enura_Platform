import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://irudhiaixvmmmvprixge.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlydWRoaWFpeHZtbW12cHJpeGdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAwOTUzNiwiZXhwIjoyMDkyNTg1NTM2fQ.TuDlXr5Gmf6k3w9Z1_GqLkX1bcoFtlBjvdnFeRgc8sM'
const PASSWORD = 'Enura@2026!Secure'
const COMPANY_ID = '00000000-0000-0000-0000-000000000001'

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const USERS = [
  { email: 's.vogel@alpen-energie.ch',  firstName: 'Sarah',   lastName: 'Vogel'  },
  { email: 'm.krings@alpen-energie.ch', firstName: 'Michael', lastName: 'Krings' },
  { email: 'h.janke@alpen-energie.ch',  firstName: 'Holger',  lastName: 'Janke'  },
  { email: 'n.janke@alpen-energie.ch',  firstName: 'Nicos',   lastName: 'Janke'  },
]

async function main() {
  // 1. Ensure a super_user role exists
  console.log('--- Checking/creating super_user role ---')
  let { data: existingRole } = await db
    .from('roles')
    .select('id')
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

  // 3. Create auth users + profiles
  for (const u of USERS) {
    console.log(`\n--- ${u.email} ---`)

    // Check if auth user already exists
    const { data: existingUsers } = await db.auth.admin.listUsers()
    const existing = existingUsers?.users?.find(usr => usr.email === u.email)

    let userId
    if (existing) {
      console.log(`  Auth user exists: ${existing.id}`)
      // Update password
      const { error: updateErr } = await db.auth.admin.updateUserById(existing.id, {
        password: PASSWORD,
        email_confirm: true,
      })
      if (updateErr) console.error(`  Failed to update password:`, updateErr.message)
      else console.log(`  Password updated`)
      userId = existing.id
    } else {
      const { data: newUser, error: createErr } = await db.auth.admin.createUser({
        email: u.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { first_name: u.firstName, last_name: u.lastName },
      })
      if (createErr) {
        console.error(`  Failed to create auth user:`, createErr.message)
        continue
      }
      userId = newUser.user.id
      console.log(`  Created auth user: ${userId}`)
    }

    // 4. Upsert profile
    const profileData = {
      id: userId,
      company_id: COMPANY_ID,
      first_name: u.firstName,
      last_name: u.lastName,
      locale: 'de-CH',
      must_reset_password: false,
      is_active: true,
    }

    const { error: profileErr } = await db
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' })

    if (profileErr) {
      console.error(`  Profile upsert failed:`, profileErr.message)
    } else {
      console.log(`  Profile upserted`)
    }

    // 5. Link to super_user role
    const { error: linkErr } = await db
      .from('profile_roles')
      .upsert(
        { profile_id: userId, role_id: roleId },
        { onConflict: 'profile_id,role_id' }
      )

    if (linkErr) {
      console.error(`  Role link failed:`, linkErr.message)
    } else {
      console.log(`  Linked to super_user role`)
    }
  }

  // 6. Summary
  console.log('\n=== DONE ===')
  console.log(`Password for all: ${PASSWORD}`)
  console.log('Users can log in at https://enura-alpenenergie.vercel.app/login')
}

main().catch(console.error)
