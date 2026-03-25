/**
 * Development seed script for the Enura Platform.
 * Creates holding admin, tenants, test users, and business data.
 *
 * Usage: npx tsx scripts/seed-dev.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// =============================================================================
// UUID Generation Helper — deterministic UUIDs from namespace + name
// =============================================================================

const SEED_NAMESPACE = 'enura-dev-seed-2026'

function deterministicUUID(name: string): string {
  const hash = createHash('sha256')
    .update(`${SEED_NAMESPACE}:${name}`)
    .digest('hex')
  // Format as UUID v4 shape (not truly v4, but valid UUID format)
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    '8' + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-')
}

// =============================================================================
// Date Helpers
// =============================================================================

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

function hoursAgo(hours: number): Date {
  const d = new Date()
  d.setHours(d.getHours() - hours)
  return d
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomWeekdayInRange(startDaysAgo: number, endDaysAgo: number): Date {
  let d: Date
  let attempts = 0
  do {
    const daysBack = randomInt(endDaysAgo, startDaysAgo)
    d = daysAgo(daysBack)
    attempts++
  } while ((d.getDay() === 0 || d.getDay() === 6) && attempts < 50)
  return d
}

function setWorkingHour(d: Date): Date {
  const hour = randomInt(8, 17)
  const minute = randomInt(0, 59)
  const second = randomInt(0, 59)
  d.setHours(hour, minute, second, 0)
  return d
}

// =============================================================================
// Auth Seeding (existing logic)
// =============================================================================

type UserSpec = {
  email: string
  password: string
  firstName: string
  lastName: string
  roleKey: string
  tenantId?: string
}

async function createUser(spec: UserSpec): Promise<string> {
  // Create auth user
  const { data, error } = await supabase.auth.admin.createUser({
    email: spec.email,
    password: spec.password,
    email_confirm: true,
    user_metadata: spec.tenantId ? { tenant_id: spec.tenantId } : {},
  })

  if (error) {
    if (error.message.includes('already been registered')) {
      // User already exists - get their ID
      const { data: users } = await supabase.auth.admin.listUsers()
      const existing = users?.users?.find(u => u.email === spec.email)
      if (existing) return existing.id
      throw error
    }
    throw error
  }

  const userId = data.user.id

  // Create profile
  await supabase.from('profiles').upsert({
    id: userId,
    tenant_id: spec.tenantId ?? null,
    first_name: spec.firstName,
    last_name: spec.lastName,
    must_reset_password: false, // Skip in dev
    totp_enabled: true, // Skip in dev
    is_active: true,
  })

  return userId
}

async function assignRole(profileId: string, tenantId: string | null, roleKey: string) {
  const query = supabase
    .from('roles')
    .select('id')
    .eq('key', roleKey)

  if (tenantId) {
    query.eq('tenant_id', tenantId)
  } else {
    query.is('tenant_id', null)
  }

  const { data: role } = await query.single()
  if (!role) {
    console.warn(`  ⚠ Role "${roleKey}" not found for tenant ${tenantId ?? 'global'}`)
    return
  }

  await supabase.from('profile_roles').upsert(
    { profile_id: profileId, role_id: role.id },
    { onConflict: 'profile_id,role_id' },
  )
}

async function createTenant(name: string, slug: string, branding: {
  primary: string; secondary: string; accent: string; font: string
}) {
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    console.log(`  ℹ Tenant "${slug}" already exists`)
    return existing.id
  }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .insert({ name, slug })
    .select()
    .single()

  if (error) throw error

  // Update branding (auto-created by trigger)
  await supabase
    .from('tenant_brandings')
    .update({
      primary_color: branding.primary,
      secondary_color: branding.secondary,
      accent_color: branding.accent,
      font_family: branding.font,
    })
    .eq('tenant_id', tenant.id)

  return tenant.id
}

// =============================================================================
// Swiss Data Constants
// =============================================================================

const SWISS_FIRST_NAMES = [
  'Hans', 'Peter', 'Markus', 'Daniel', 'Andreas', 'Stefan', 'Christian', 'Martin',
  'Thomas', 'Michael', 'Bruno', 'Beat', 'Urs', 'Rolf', 'Kurt',
  'Maria', 'Anna', 'Ruth', 'Elisabeth', 'Monika', 'Ursula', 'Brigitte', 'Christine',
  'Barbara', 'Claudia', 'Franziska', 'Heidi', 'Kathrin', 'Silvia', 'Verena',
]

const SWISS_LAST_NAMES = [
  'Müller', 'Schneider', 'Fischer', 'Weber', 'Brunner', 'Steiner', 'Meier',
  'Keller', 'Huber', 'Schmid', 'Wyss', 'Baumgartner', 'Gerber', 'Zimmermann',
  'Hofmann', 'Berger', 'Frei', 'Moser', 'Lüthi', 'Baumann',
]

const SWISS_CITIES: Array<{ city: string; zip: string; canton: string }> = [
  { city: 'Zürich', zip: '8001', canton: 'ZH' },
  { city: 'Bern', zip: '3001', canton: 'BE' },
  { city: 'Basel', zip: '4001', canton: 'BS' },
  { city: 'Luzern', zip: '6003', canton: 'LU' },
  { city: 'Winterthur', zip: '8400', canton: 'ZH' },
  { city: 'St. Gallen', zip: '9000', canton: 'SG' },
  { city: 'Thun', zip: '3600', canton: 'BE' },
  { city: 'Aarau', zip: '5000', canton: 'AG' },
  { city: 'Olten', zip: '4600', canton: 'SO' },
  { city: 'Baden', zip: '5400', canton: 'AG' },
  { city: 'Solothurn', zip: '4500', canton: 'SO' },
  { city: 'Frauenfeld', zip: '8500', canton: 'TG' },
  { city: 'Rapperswil', zip: '8640', canton: 'SG' },
  { city: 'Zug', zip: '6300', canton: 'ZG' },
  { city: 'Schaffhausen', zip: '8200', canton: 'SH' },
]

const SWISS_STREETS = [
  'Bahnhofstrasse', 'Hauptstrasse', 'Dorfstrasse', 'Kirchgasse', 'Sonnenbergstrasse',
  'Seestrasse', 'Bergstrasse', 'Industriestrasse', 'Schulstrasse', 'Gartenstrasse',
  'Mühlegasse', 'Oberdorfstrasse', 'Birkenweg', 'Rosenweg', 'Feldweg',
]

const LEAD_SOURCES: Array<'website' | 'referral' | 'partner' | 'advertising' | 'cold_call' | 'leadnotes' | 'other'> = [
  'website', 'referral', 'partner', 'advertising', 'leadnotes', 'website', 'referral',
]

function swissPhone(): string {
  const prefix = randomChoice(['79', '78', '76', '77'])
  const n1 = String(randomInt(100, 999))
  const n2 = String(randomInt(10, 99))
  const n3 = String(randomInt(10, 99))
  return `+41 ${prefix} ${n1} ${n2} ${n3}`
}

function swissAddress(): { street: string; zip: string; city: string; canton: string } {
  const loc = randomChoice(SWISS_CITIES)
  return {
    street: `${randomChoice(SWISS_STREETS)} ${randomInt(1, 120)}`,
    zip: loc.zip,
    city: loc.city,
    canton: loc.canton,
  }
}

// =============================================================================
// Phase Definitions Data
// =============================================================================

const PHASE_DEFINITIONS = [
  { phase_number: 1, name: 'Auftrag eingegangen', color: '#3B82F6' },
  { phase_number: 2, name: 'Technische Prüfung', color: '#6366F1' },
  { phase_number: 3, name: 'Planung', color: '#8B5CF6' },
  { phase_number: 4, name: 'Bewilligung eingereicht', color: '#A855F7' },
  { phase_number: 5, name: 'Verzögerung', color: '#EF4444' },
  { phase_number: 6, name: 'Bewilligung erteilt', color: '#22C55E' },
  { phase_number: 7, name: 'Material bestellt', color: '#F59E0B' },
  { phase_number: 8, name: 'Material geliefert', color: '#F97316' },
  { phase_number: 9, name: 'Gerüst geplant', color: '#14B8A6' },
  { phase_number: 10, name: 'Gerüst aufgebaut', color: '#06B6D4' },
  { phase_number: 11, name: 'DC-Montage', color: '#0EA5E9' },
  { phase_number: 12, name: 'AC-Montage', color: '#2563EB' },
  { phase_number: 13, name: 'Zählermontage', color: '#4F46E5' },
  { phase_number: 14, name: 'Inbetriebnahme', color: '#7C3AED' },
  { phase_number: 15, name: 'Abnahme intern', color: '#9333EA' },
  { phase_number: 16, name: 'Abnahme Kunde', color: '#A855F7' },
  { phase_number: 17, name: 'DC-Rechnung', color: '#D946EF' },
  { phase_number: 18, name: 'Dokumentation', color: '#EC4899' },
  { phase_number: 19, name: 'Meldung EVU', color: '#F43F5E' },
  { phase_number: 20, name: 'Meldung ESTI', color: '#FB7185' },
  { phase_number: 21, name: 'Förderbeitrag', color: '#10B981' },
  { phase_number: 22, name: 'Steuerabzug', color: '#34D399' },
  { phase_number: 23, name: 'Schlussrechnung', color: '#6EE7B7' },
  { phase_number: 24, name: 'Garantie aktiv', color: '#84CC16' },
  { phase_number: 25, name: '1. Wartung', color: '#A3E635' },
  { phase_number: 26, name: '2. Wartung', color: '#BEF264' },
  { phase_number: 27, name: 'Projekt abgeschlossen', color: '#4ADE80' },
]

// =============================================================================
// Business Data Seeding Functions
// =============================================================================

async function seedTeamMembers(
  tenantId: string,
  userMap: Map<string, string>,
): Promise<Map<string, string>> {
  console.log('\n👥 Seeding team members...')

  const teamMembers = [
    {
      id: deterministicUUID('tm-setter-1'),
      tenant_id: tenantId,
      profile_id: userMap.get('l.weber@alpen-energie.ch') ?? null,
      external_id: 'reonic-tm-001',
      first_name: 'Lukas',
      last_name: 'Weber',
      email: 'l.weber@alpen-energie.ch',
      phone: '+41 79 312 45 67',
      role_type: 'setter',
      team: 'Vertrieb',
      is_active: true,
    },
    {
      id: deterministicUUID('tm-setter-2'),
      tenant_id: tenantId,
      profile_id: userMap.get('s.meier@alpen-energie.ch') ?? null,
      external_id: 'reonic-tm-002',
      first_name: 'Sarah',
      last_name: 'Meier',
      email: 's.meier@alpen-energie.ch',
      phone: '+41 79 445 78 12',
      role_type: 'setter',
      team: 'Vertrieb',
      is_active: true,
    },
    {
      id: deterministicUUID('tm-berater-1'),
      tenant_id: tenantId,
      profile_id: userMap.get('t.mueller@alpen-energie.ch') ?? null,
      external_id: 'reonic-tm-003',
      first_name: 'Thomas',
      last_name: 'Müller',
      email: 't.mueller@alpen-energie.ch',
      phone: '+41 79 223 56 89',
      role_type: 'berater',
      team: 'Beratung',
      is_active: true,
    },
    {
      id: deterministicUUID('tm-berater-2'),
      tenant_id: tenantId,
      profile_id: userMap.get('m.bernasconi@alpen-energie.ch') ?? null,
      external_id: 'reonic-tm-004',
      first_name: 'Marco',
      last_name: 'Bernasconi',
      email: 'm.bernasconi@alpen-energie.ch',
      phone: '+41 79 667 34 21',
      role_type: 'berater',
      team: 'Beratung',
      is_active: true,
    },
    {
      id: deterministicUUID('tm-innendienst-1'),
      tenant_id: tenantId,
      profile_id: userMap.get('s.brunner@alpen-energie.ch') ?? null,
      external_id: 'reonic-tm-005',
      first_name: 'Sandra',
      last_name: 'Brunner',
      email: 's.brunner@alpen-energie.ch',
      phone: '+41 79 556 12 34',
      role_type: 'innendienst',
      team: 'Innendienst',
      is_active: true,
    },
    {
      id: deterministicUUID('tm-bau-1'),
      tenant_id: tenantId,
      profile_id: userMap.get('r.keller@alpen-energie.ch') ?? null,
      external_id: 'reonic-tm-006',
      first_name: 'Reto',
      last_name: 'Keller',
      email: 'r.keller@alpen-energie.ch',
      phone: '+41 79 889 45 67',
      role_type: 'bau',
      team: 'Montage',
      is_active: true,
    },
  ]

  const { error } = await supabase
    .from('team_members')
    .upsert(teamMembers, { onConflict: 'id' })

  if (error) throw new Error(`Failed to seed team members: ${error.message}`)

  const tmMap = new Map<string, string>()
  for (const tm of teamMembers) {
    tmMap.set(`${tm.role_type}-${tm.first_name}`, tm.id)
  }
  console.log(`  ✓ ${teamMembers.length} team members created`)
  return tmMap
}

async function seedPhaseDefinitions(tenantId: string): Promise<Map<number, string>> {
  console.log('\n📋 Seeding phase definitions (27 phases)...')

  const phases = PHASE_DEFINITIONS.map(p => ({
    id: deterministicUUID(`phase-${p.phase_number}`),
    tenant_id: tenantId,
    phase_number: p.phase_number,
    name: p.name,
    color: p.color,
    stall_threshold_days: p.phase_number === 5 ? 3 : 7,
  }))

  const { error } = await supabase
    .from('phase_definitions')
    .upsert(phases, { onConflict: 'tenant_id,phase_number' })

  if (error) throw new Error(`Failed to seed phase definitions: ${error.message}`)

  const phaseMap = new Map<number, string>()
  for (const p of phases) {
    phaseMap.set(p.phase_number, p.id)
  }
  console.log(`  ✓ ${phases.length} phase definitions created`)
  return phaseMap
}

async function seedLeads(
  tenantId: string,
  setterIds: string[],
): Promise<string[]> {
  console.log('\n📌 Seeding leads...')

  const leads: Array<Record<string, unknown>> = []

  // 15 qualified leads with setter assigned
  for (let i = 0; i < 15; i++) {
    const addr = swissAddress()
    const firstName = randomChoice(SWISS_FIRST_NAMES)
    const lastName = randomChoice(SWISS_LAST_NAMES)
    leads.push({
      id: deterministicUUID(`lead-qualified-${i}`),
      tenant_id: tenantId,
      external_id: `reonic-lead-q${String(i + 1).padStart(3, '0')}`,
      first_name: firstName,
      last_name: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace('ü', 'ue').replace('ä', 'ae').replace('ö', 'oe')}@example.ch`,
      phone: swissPhone(),
      address_street: addr.street,
      address_zip: addr.zip,
      address_city: addr.city,
      address_canton: addr.canton,
      status: 'qualified',
      source: randomChoice(LEAD_SOURCES),
      setter_id: randomChoice(setterIds),
      notes: `Interesse an PV-Anlage, Dachfläche ca. ${randomInt(30, 120)}m²`,
      qualified_at: daysAgo(randomInt(5, 45)).toISOString(),
      created_at: daysAgo(randomInt(10, 60)).toISOString(),
    })
  }

  // 10 appointment_set leads with setter assigned
  for (let i = 0; i < 10; i++) {
    const addr = swissAddress()
    const firstName = randomChoice(SWISS_FIRST_NAMES)
    const lastName = randomChoice(SWISS_LAST_NAMES)
    leads.push({
      id: deterministicUUID(`lead-appt-${i}`),
      tenant_id: tenantId,
      external_id: `reonic-lead-a${String(i + 1).padStart(3, '0')}`,
      first_name: firstName,
      last_name: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace('ü', 'ue').replace('ä', 'ae').replace('ö', 'oe')}@example.ch`,
      phone: swissPhone(),
      address_street: addr.street,
      address_zip: addr.zip,
      address_city: addr.city,
      address_canton: addr.canton,
      status: 'appointment_set',
      source: randomChoice(LEAD_SOURCES),
      setter_id: randomChoice(setterIds),
      notes: `Beratungstermin vereinbart`,
      qualified_at: daysAgo(randomInt(3, 30)).toISOString(),
      created_at: daysAgo(randomInt(7, 50)).toISOString(),
    })
  }

  // 8 new leads, no setter (some < 4h ago for "unworked" metric)
  for (let i = 0; i < 8; i++) {
    const addr = swissAddress()
    const firstName = randomChoice(SWISS_FIRST_NAMES)
    const lastName = randomChoice(SWISS_LAST_NAMES)
    // First 3 are recent (< 4h) for unworked metric
    const createdAt = i < 3
      ? hoursAgo(randomInt(1, 3)).toISOString()
      : daysAgo(randomInt(1, 10)).toISOString()
    leads.push({
      id: deterministicUUID(`lead-new-${i}`),
      tenant_id: tenantId,
      external_id: `reonic-lead-n${String(i + 1).padStart(3, '0')}`,
      first_name: firstName,
      last_name: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace('ü', 'ue').replace('ä', 'ae').replace('ö', 'oe')}@example.ch`,
      phone: swissPhone(),
      address_street: addr.street,
      address_zip: addr.zip,
      address_city: addr.city,
      address_canton: addr.canton,
      status: 'new',
      source: randomChoice(LEAD_SOURCES),
      setter_id: null,
      notes: null,
      created_at: createdAt,
    })
  }

  // 5 lost leads
  for (let i = 0; i < 5; i++) {
    const addr = swissAddress()
    const firstName = randomChoice(SWISS_FIRST_NAMES)
    const lastName = randomChoice(SWISS_LAST_NAMES)
    leads.push({
      id: deterministicUUID(`lead-lost-${i}`),
      tenant_id: tenantId,
      external_id: `reonic-lead-l${String(i + 1).padStart(3, '0')}`,
      first_name: firstName,
      last_name: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace('ü', 'ue').replace('ä', 'ae').replace('ö', 'oe')}@example.ch`,
      phone: swissPhone(),
      address_street: addr.street,
      address_zip: addr.zip,
      address_city: addr.city,
      address_canton: addr.canton,
      status: 'lost',
      source: randomChoice(LEAD_SOURCES),
      setter_id: randomChoice(setterIds),
      notes: 'Kein Interesse / anderer Anbieter gewählt',
      created_at: daysAgo(randomInt(20, 80)).toISOString(),
    })
  }

  // 2 won leads
  for (let i = 0; i < 2; i++) {
    const addr = swissAddress()
    const firstName = randomChoice(SWISS_FIRST_NAMES)
    const lastName = randomChoice(SWISS_LAST_NAMES)
    leads.push({
      id: deterministicUUID(`lead-won-${i}`),
      tenant_id: tenantId,
      external_id: `reonic-lead-w${String(i + 1).padStart(3, '0')}`,
      first_name: firstName,
      last_name: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace('ü', 'ue').replace('ä', 'ae').replace('ö', 'oe')}@example.ch`,
      phone: swissPhone(),
      address_street: addr.street,
      address_zip: addr.zip,
      address_city: addr.city,
      address_canton: addr.canton,
      status: 'won',
      source: randomChoice(LEAD_SOURCES),
      setter_id: randomChoice(setterIds),
      notes: 'Auftrag erteilt',
      qualified_at: daysAgo(randomInt(30, 60)).toISOString(),
      created_at: daysAgo(randomInt(40, 90)).toISOString(),
    })
  }

  const { error } = await supabase
    .from('leads')
    .upsert(leads, { onConflict: 'id' })

  if (error) throw new Error(`Failed to seed leads: ${error.message}`)

  console.log(`  ✓ ${leads.length} leads created`)
  return leads.map(l => l.id as string)
}

async function seedOffers(
  tenantId: string,
  leadIds: string[],
  beraterIds: string[],
): Promise<string[]> {
  console.log('\n💼 Seeding offers...')

  // Use qualified, appointment_set, and won leads for offers
  const eligibleLeadIds = leadIds.slice(0, 27) // qualified + appointment_set + some new
  const offers: Array<Record<string, unknown>> = []

  const kwpSizes = [8, 10, 12, 15, 18, 20, 22, 25, 30]

  // 8 won offers (CHF 18'000-45'000)
  for (let i = 0; i < 8; i++) {
    const kwp = randomChoice(kwpSizes)
    const lastName = randomChoice(SWISS_LAST_NAMES)
    const amount = randomInt(18000, 45000)
    const sentDate = daysAgo(randomInt(30, 75))
    const decidedDate = daysAgo(randomInt(5, 29))
    offers.push({
      id: deterministicUUID(`offer-won-${i}`),
      tenant_id: tenantId,
      external_id: `reonic-offer-w${String(i + 1).padStart(3, '0')}`,
      lead_id: eligibleLeadIds[i % eligibleLeadIds.length],
      berater_id: randomChoice(beraterIds),
      title: `PV-Anlage ${kwp}kWp Familie ${lastName}`,
      description: `Photovoltaikanlage ${kwp}kWp mit Batteriespeicher`,
      amount_chf: amount,
      status: 'won',
      sent_at: sentDate.toISOString(),
      decided_at: decidedDate.toISOString(),
      valid_until: formatDate(daysAgo(-30)),
      created_at: daysAgo(randomInt(35, 80)).toISOString(),
    })
  }

  // 5 negotiating offers (CHF 22'000-60'000)
  for (let i = 0; i < 5; i++) {
    const kwp = randomChoice(kwpSizes)
    const lastName = randomChoice(SWISS_LAST_NAMES)
    const amount = randomInt(22000, 60000)
    offers.push({
      id: deterministicUUID(`offer-neg-${i}`),
      tenant_id: tenantId,
      external_id: `reonic-offer-n${String(i + 1).padStart(3, '0')}`,
      lead_id: eligibleLeadIds[(8 + i) % eligibleLeadIds.length],
      berater_id: randomChoice(beraterIds),
      title: `PV-Anlage ${kwp}kWp Familie ${lastName}`,
      description: `Photovoltaikanlage ${kwp}kWp inkl. Wärmepumpe`,
      amount_chf: amount,
      status: 'negotiating',
      sent_at: daysAgo(randomInt(7, 30)).toISOString(),
      valid_until: formatDate(daysAgo(-14)),
      created_at: daysAgo(randomInt(10, 40)).toISOString(),
    })
  }

  // 4 sent offers (CHF 15'000-40'000)
  for (let i = 0; i < 4; i++) {
    const kwp = randomChoice(kwpSizes)
    const lastName = randomChoice(SWISS_LAST_NAMES)
    const amount = randomInt(15000, 40000)
    offers.push({
      id: deterministicUUID(`offer-sent-${i}`),
      tenant_id: tenantId,
      external_id: `reonic-offer-s${String(i + 1).padStart(3, '0')}`,
      lead_id: eligibleLeadIds[(13 + i) % eligibleLeadIds.length],
      berater_id: randomChoice(beraterIds),
      title: `PV-Anlage ${kwp}kWp Familie ${lastName}`,
      description: `Photovoltaikanlage ${kwp}kWp Flachdach`,
      amount_chf: amount,
      status: 'sent',
      sent_at: daysAgo(randomInt(1, 14)).toISOString(),
      valid_until: formatDate(daysAgo(-21)),
      created_at: daysAgo(randomInt(3, 20)).toISOString(),
    })
  }

  // 2 lost offers
  for (let i = 0; i < 2; i++) {
    const kwp = randomChoice(kwpSizes)
    const lastName = randomChoice(SWISS_LAST_NAMES)
    const amount = randomInt(20000, 50000)
    offers.push({
      id: deterministicUUID(`offer-lost-${i}`),
      tenant_id: tenantId,
      external_id: `reonic-offer-l${String(i + 1).padStart(3, '0')}`,
      lead_id: eligibleLeadIds[(17 + i) % eligibleLeadIds.length],
      berater_id: randomChoice(beraterIds),
      title: `PV-Anlage ${kwp}kWp Familie ${lastName}`,
      description: `Angebot abgelehnt — Konkurrenzangebot`,
      amount_chf: amount,
      status: 'lost',
      sent_at: daysAgo(randomInt(20, 50)).toISOString(),
      decided_at: daysAgo(randomInt(10, 19)).toISOString(),
      created_at: daysAgo(randomInt(25, 60)).toISOString(),
    })
  }

  // 1 expired offer
  {
    const kwp = randomChoice(kwpSizes)
    const lastName = randomChoice(SWISS_LAST_NAMES)
    offers.push({
      id: deterministicUUID('offer-expired-0'),
      tenant_id: tenantId,
      external_id: 'reonic-offer-e001',
      lead_id: eligibleLeadIds[19 % eligibleLeadIds.length],
      berater_id: randomChoice(beraterIds),
      title: `PV-Anlage ${kwp}kWp Familie ${lastName}`,
      description: `Angebot abgelaufen — keine Rückmeldung`,
      amount_chf: randomInt(25000, 45000),
      status: 'expired',
      sent_at: daysAgo(45).toISOString(),
      valid_until: formatDate(daysAgo(15)),
      created_at: daysAgo(50).toISOString(),
    })
  }

  const { error } = await supabase
    .from('offers')
    .upsert(offers, { onConflict: 'id' })

  if (error) throw new Error(`Failed to seed offers: ${error.message}`)

  console.log(`  ✓ ${offers.length} offers created`)
  return offers.filter(o => o.status === 'won').map(o => o.id as string)
}

async function seedCalls(
  tenantId: string,
  setterIds: string[],
): Promise<number> {
  console.log('\n📞 Seeding calls...')

  const calls: Array<Record<string, unknown>> = []
  let callIndex = 0

  for (const setterId of setterIds) {
    const callCount = 75

    for (let i = 0; i < callCount; i++) {
      const callDate = randomWeekdayInRange(1, 30)
      setWorkingHour(callDate)

      // Determine call outcome
      const roll = Math.random()
      let status: string
      let duration: number
      if (roll < 0.60) {
        status = 'answered'
        duration = randomInt(120, 480)
      } else if (roll < 0.85) {
        status = 'missed'
        duration = 0
      } else {
        status = 'voicemail'
        duration = randomInt(30, 60)
      }

      const direction = Math.random() < 0.80 ? 'outbound' : 'inbound'

      const endedAt = new Date(callDate.getTime() + duration * 1000)

      calls.push({
        id: deterministicUUID(`call-${callIndex}`),
        tenant_id: tenantId,
        external_id: `3cx-call-${String(callIndex + 1).padStart(4, '0')}`,
        team_member_id: setterId,
        direction,
        status,
        caller_number: direction === 'outbound' ? '+41 44 123 45 67' : swissPhone(),
        callee_number: direction === 'outbound' ? swissPhone() : '+41 44 123 45 67',
        duration_seconds: duration,
        started_at: callDate.toISOString(),
        ended_at: endedAt.toISOString(),
      })

      callIndex++
    }
  }

  // Insert in batches of 50 to avoid payload size issues
  const batchSize = 50
  for (let i = 0; i < calls.length; i += batchSize) {
    const batch = calls.slice(i, i + batchSize)
    const { error } = await supabase
      .from('calls')
      .upsert(batch, { onConflict: 'id,started_at' })

    if (error) throw new Error(`Failed to seed calls batch ${i}: ${error.message}`)
  }

  console.log(`  ✓ ${calls.length} calls created`)
  return calls.length
}

async function seedProjects(
  tenantId: string,
  wonOfferIds: string[],
  beraterIds: string[],
  phaseMap: Map<number, string>,
  leadIds: string[],
): Promise<string[]> {
  console.log('\n🏗️  Seeding projects...')

  const projects: Array<Record<string, unknown>> = []

  // Distribute 20 projects across phases
  // Ensure at least 2 in phase 5 (Verzögerung), spread the rest
  const phaseDistribution = [
    1, 1, 2, 3, 5, 5, 6, 7, 8, 9,
    10, 11, 12, 14, 16, 18, 20, 23, 25, 27,
  ]

  for (let i = 0; i < 20; i++) {
    const phaseNumber = phaseDistribution[i]
    const phaseId = phaseMap.get(phaseNumber)
    const addr = swissAddress()
    const lastName = randomChoice(SWISS_LAST_NAMES)
    const kwp = randomChoice([10, 12, 15, 18, 20, 22, 25])

    // Some projects stalled > 7 days (especially phase 5)
    const phaseEnteredDaysAgo = phaseNumber === 5
      ? randomInt(8, 20) // Stalled in Verzögerung
      : randomInt(1, 14)

    const isCompleted = phaseNumber === 27
    const installDate = phaseNumber >= 11
      ? formatDate(daysAgo(randomInt(5, 40)))
      : phaseNumber >= 7
        ? formatDate(daysAgo(-randomInt(5, 30)))
        : null

    projects.push({
      id: deterministicUUID(`project-${i}`),
      tenant_id: tenantId,
      external_id: `reonic-proj-${String(i + 1).padStart(3, '0')}`,
      lead_id: leadIds[i % leadIds.length],
      offer_id: wonOfferIds[i % wonOfferIds.length],
      berater_id: randomChoice(beraterIds),
      title: `PV-Anlage ${kwp}kWp ${lastName}, ${addr.city}`,
      customer_name: `${randomChoice(SWISS_FIRST_NAMES)} ${lastName}`,
      address_street: addr.street,
      address_zip: addr.zip,
      address_city: addr.city,
      phase_id: phaseId,
      status: isCompleted ? 'completed' : 'active',
      phase_entered_at: daysAgo(phaseEnteredDaysAgo).toISOString(),
      installation_date: installDate,
      completion_date: isCompleted ? formatDate(daysAgo(randomInt(1, 10))) : null,
      notes: phaseNumber === 5 ? 'Warten auf Baubewilligung der Gemeinde' : null,
      created_at: daysAgo(randomInt(30, 90)).toISOString(),
    })
  }

  const { error } = await supabase
    .from('projects')
    .upsert(projects, { onConflict: 'id' })

  if (error) throw new Error(`Failed to seed projects: ${error.message}`)

  console.log(`  ✓ ${projects.length} projects created`)
  return projects.map(p => p.id as string)
}

async function seedInvoices(
  tenantId: string,
  offerIds: string[],
): Promise<number> {
  console.log('\n🧾 Seeding invoices...')

  const invoices: Array<Record<string, unknown>> = []
  let invoiceNum = 1

  const statusDistribution: Array<{ status: string; count: number }> = [
    { status: 'paid', count: 10 },
    { status: 'sent', count: 8 },
    { status: 'overdue', count: 4 },
    { status: 'partially_paid', count: 3 },
  ]

  for (const { status, count } of statusDistribution) {
    for (let i = 0; i < count; i++) {
      const lastName = randomChoice(SWISS_LAST_NAMES)
      const firstName = randomChoice(SWISS_FIRST_NAMES)
      const amountNet = randomInt(5000, 45000)
      const tax = Math.round(amountNet * 0.081 * 100) / 100 // 8.1% Swiss VAT
      const total = Math.round((amountNet + tax) * 100) / 100

      let issuedDaysAgo: number
      let dueDaysAfterIssue: number
      let paidAt: string | null = null

      if (status === 'paid') {
        issuedDaysAgo = randomInt(20, 70)
        dueDaysAfterIssue = 30
        paidAt = formatDate(daysAgo(randomInt(1, issuedDaysAgo - 5)))
      } else if (status === 'overdue') {
        issuedDaysAgo = randomInt(40, 60)
        dueDaysAfterIssue = 30
      } else if (status === 'partially_paid') {
        issuedDaysAgo = randomInt(25, 50)
        dueDaysAfterIssue = 30
      } else {
        // sent (open)
        issuedDaysAgo = randomInt(5, 25)
        dueDaysAfterIssue = 30
      }

      const issuedAt = daysAgo(issuedDaysAgo)
      const dueAt = new Date(issuedAt)
      dueAt.setDate(dueAt.getDate() + dueDaysAfterIssue)

      invoices.push({
        id: deterministicUUID(`invoice-${invoiceNum}`),
        tenant_id: tenantId,
        external_id: `bexio-inv-${String(invoiceNum).padStart(3, '0')}`,
        offer_id: offerIds[invoiceNum % offerIds.length] ?? null,
        invoice_number: `RE-2026-${String(invoiceNum).padStart(3, '0')}`,
        customer_name: `${firstName} ${lastName}`,
        amount_chf: amountNet,
        tax_chf: tax,
        total_chf: total,
        status,
        issued_at: formatDate(issuedAt),
        due_at: formatDate(dueAt),
        paid_at: paidAt,
        created_at: issuedAt.toISOString(),
      })

      invoiceNum++
    }
  }

  const { error } = await supabase
    .from('invoices')
    .upsert(invoices, { onConflict: 'id' })

  if (error) throw new Error(`Failed to seed invoices: ${error.message}`)

  console.log(`  ✓ ${invoices.length} invoices created`)
  return invoices.length
}

async function seedKpiSnapshots(
  tenantId: string,
  setterIds: string[],
): Promise<number> {
  console.log('\n📊 Seeding KPI snapshots...')

  const snapshots: Array<Record<string, unknown>> = []

  for (let day = 0; day < 30; day++) {
    const periodDate = formatDate(daysAgo(day))

    // setter_daily for each setter
    for (const setterId of setterIds) {
      const callsTotal = randomInt(15, 35)
      const answered = Math.round(callsTotal * (0.55 + Math.random() * 0.15))
      const appointments = randomInt(1, 5)
      snapshots.push({
        id: deterministicUUID(`kpi-setter-${setterId}-${day}`),
        tenant_id: tenantId,
        snapshot_type: 'setter_daily',
        entity_id: setterId,
        period_date: periodDate,
        metrics: {
          calls_total: callsTotal,
          calls_answered: answered,
          calls_missed: callsTotal - answered,
          reach_rate: Math.round((answered / callsTotal) * 100) / 100,
          appointments_booked: appointments,
          appointment_rate: Math.round((appointments / answered) * 100) / 100,
          avg_call_duration_seconds: randomInt(150, 320),
          no_show_rate: Math.round(Math.random() * 0.15 * 100) / 100,
        },
      })
    }

    // leads_daily for the tenant
    snapshots.push({
      id: deterministicUUID(`kpi-leads-${day}`),
      tenant_id: tenantId,
      snapshot_type: 'leads_daily',
      entity_id: null,
      period_date: periodDate,
      metrics: {
        new_leads: randomInt(2, 8),
        unworked_leads: randomInt(0, 5),
        avg_response_time_minutes: randomInt(15, 180),
        qualified_rate: Math.round((0.3 + Math.random() * 0.3) * 100) / 100,
        leads_by_source: {
          website: randomInt(1, 4),
          referral: randomInt(0, 2),
          partner: randomInt(0, 2),
          advertising: randomInt(0, 3),
          leadnotes: randomInt(0, 2),
        },
      },
    })

    // projects_daily for the tenant
    snapshots.push({
      id: deterministicUUID(`kpi-projects-${day}`),
      tenant_id: tenantId,
      snapshot_type: 'projects_daily',
      entity_id: null,
      period_date: periodDate,
      metrics: {
        active_projects: randomInt(14, 20),
        completed_projects: randomInt(0, 2),
        stalled_projects: randomInt(1, 4),
        avg_throughput_days: randomInt(45, 90),
        projects_in_verzögerung: randomInt(1, 3),
      },
    })
  }

  // Insert in batches
  const batchSize = 50
  for (let i = 0; i < snapshots.length; i += batchSize) {
    const batch = snapshots.slice(i, i + batchSize)
    const { error } = await supabase
      .from('kpi_snapshots')
      .upsert(batch, { onConflict: 'id,period_date' })

    if (error) throw new Error(`Failed to seed KPI snapshots batch ${i}: ${error.message}`)
  }

  console.log(`  ✓ ${snapshots.length} KPI snapshots created`)
  return snapshots.length
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('\n🚀 Enura Platform — Development Seed\n')
  console.log('─'.repeat(60))

  // ─── Holding Admin ───
  console.log('\n📋 Creating holding admin...')
  const holdingAdminId = await createUser({
    email: 'admin@enura-group.com',
    password: 'Admin@Enura2026!',
    firstName: 'System',
    lastName: 'Admin',
    roleKey: 'holding_admin',
  })

  // Insert into holding_admins table
  await supabase.from('holding_admins').upsert(
    { profile_id: holdingAdminId },
    { onConflict: 'profile_id' },
  )

  console.log('  ✓ admin@enura-group.com')

  // ─── Tenant: Alpen Energie GmbH ───
  console.log('\n🏢 Creating tenant: Alpen Energie GmbH...')
  const alpenId = await createTenant('Alpen Energie GmbH', 'alpen-energie', {
    primary: '#E25C20', secondary: '#1A1A1A', accent: '#F3A917', font: 'Inter',
  })

  const alpenUsers: UserSpec[] = [
    { email: 'm.krings@alpen-energie.ch', password: 'Super@Alpen2026!', firstName: 'Michael', lastName: 'Krings', roleKey: 'super_user', tenantId: alpenId },
    { email: 'l.weber@alpen-energie.ch', password: 'Test@2026!setter', firstName: 'Lukas', lastName: 'Weber', roleKey: 'setter', tenantId: alpenId },
    { email: 's.meier@alpen-energie.ch', password: 'Test@2026!setter2', firstName: 'Sarah', lastName: 'Meier', roleKey: 'setter', tenantId: alpenId },
    { email: 't.mueller@alpen-energie.ch', password: 'Test@2026!berater', firstName: 'Thomas', lastName: 'Müller', roleKey: 'berater', tenantId: alpenId },
    { email: 'm.bernasconi@alpen-energie.ch', password: 'Test@2026!berater2', firstName: 'Marco', lastName: 'Bernasconi', roleKey: 'berater', tenantId: alpenId },
    { email: 's.brunner@alpen-energie.ch', password: 'Test@2026!innendienst', firstName: 'Sandra', lastName: 'Brunner', roleKey: 'innendienst', tenantId: alpenId },
    { email: 'r.keller@alpen-energie.ch', password: 'Test@2026!bau', firstName: 'Reto', lastName: 'Keller', roleKey: 'bau', tenantId: alpenId },
    { email: 'a.steiner@alpen-energie.ch', password: 'Test@2026!buchhaltung', firstName: 'Anna', lastName: 'Steiner', roleKey: 'buchhaltung', tenantId: alpenId },
    { email: 'p.fischer@alpen-energie.ch', password: 'Test@2026!leadkontrolle', firstName: 'Peter', lastName: 'Fischer', roleKey: 'leadkontrolle', tenantId: alpenId },
  ]

  // Track user IDs for team member linking
  const userMap = new Map<string, string>()

  for (const spec of alpenUsers) {
    const userId = await createUser(spec)
    await assignRole(userId, alpenId, spec.roleKey)
    userMap.set(spec.email, userId)
    console.log(`  ✓ ${spec.email} (${spec.roleKey})`)
  }

  // ─── Tenant: Test Company AG ───
  console.log('\n🏢 Creating tenant: Test Company AG...')
  const testId = await createTenant('Test Company AG', 'test-company', {
    primary: '#2563EB', secondary: '#1E293B', accent: '#F59E0B', font: 'Inter',
  })

  const testUsers: UserSpec[] = [
    { email: 'admin@test-company.ch', password: 'Super@Test2026!', firstName: 'Admin', lastName: 'Test', roleKey: 'super_user', tenantId: testId },
  ]

  for (const spec of testUsers) {
    const userId = await createUser(spec)
    await assignRole(userId, testId, spec.roleKey)
    console.log(`  ✓ ${spec.email} (${spec.roleKey})`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BUSINESS DATA (Alpen Energie only)
  // ─────────────────────────────────────────────────────────────────────────

  console.log('\n' + '─'.repeat(60))
  console.log('📦 Seeding business data for Alpen Energie GmbH...')

  // 1. Phase Definitions
  const phaseMap = await seedPhaseDefinitions(alpenId)

  // 2. Team Members
  const tmMap = await seedTeamMembers(alpenId, userMap)

  const setter1Id = deterministicUUID('tm-setter-1')
  const setter2Id = deterministicUUID('tm-setter-2')
  const berater1Id = deterministicUUID('tm-berater-1')
  const berater2Id = deterministicUUID('tm-berater-2')

  const setterIds = [setter1Id, setter2Id]
  const beraterIds = [berater1Id, berater2Id]

  // 3. Leads
  const leadIds = await seedLeads(alpenId, setterIds)

  // 4. Offers
  const wonOfferIds = await seedOffers(alpenId, leadIds, beraterIds)

  // 5. Calls
  const callCount = await seedCalls(alpenId, setterIds)

  // 6. Projects
  const projectIds = await seedProjects(alpenId, wonOfferIds, beraterIds, phaseMap, leadIds)

  // 7. Invoices
  // Collect all offer IDs (won ones) for invoice linking
  const allWonOfferIds = wonOfferIds.length > 0 ? wonOfferIds : [deterministicUUID('offer-won-0')]
  const invoiceCount = await seedInvoices(alpenId, allWonOfferIds)

  // 8. KPI Snapshots
  const kpiCount = await seedKpiSnapshots(alpenId, setterIds)

  // ─── Verification ───
  console.log('\n' + '─'.repeat(60))

  const [
    { count: tmCount },
    { count: leadCount },
    { count: offerCount },
    { count: projCount },
    { count: invCount },
    { count: phaseCount },
  ] = await Promise.all([
    supabase.from('team_members').select('*', { count: 'exact', head: true }).eq('tenant_id', alpenId),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('tenant_id', alpenId),
    supabase.from('offers').select('*', { count: 'exact', head: true }).eq('tenant_id', alpenId),
    supabase.from('projects').select('*', { count: 'exact', head: true }).eq('tenant_id', alpenId),
    supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('tenant_id', alpenId),
    supabase.from('phase_definitions').select('*', { count: 'exact', head: true }).eq('tenant_id', alpenId),
  ])

  console.log('\n📊 Verification:')
  console.log(`  Team Members:      ${tmCount}`)
  console.log(`  Leads:             ${leadCount}`)
  console.log(`  Offers:            ${offerCount}`)
  console.log(`  Calls:             ${callCount} (inserted)`)
  console.log(`  Projects:          ${projCount}`)
  console.log(`  Invoices:          ${invCount}`)
  console.log(`  Phase Definitions: ${phaseCount}`)
  console.log(`  KPI Snapshots:     ${kpiCount} (inserted)`)

  // ─── Summary ───
  console.log('\n' + '─'.repeat(60))
  console.log('\n⚠️  DEV SEED COMPLETE — These credentials are for development only.')
  console.log('    Never use this script against a production database.\n')
  console.log('📋 Credentials:\n')
  console.log('  HOLDING ADMIN:')
  console.log('    Email:    admin@enura-group.com')
  console.log('    Password: Admin@Enura2026!\n')
  console.log('  ALPEN ENERGIE GmbH (slug: alpen-energie):')
  console.log('    Super User:    m.krings@alpen-energie.ch / Super@Alpen2026!')
  console.log('    Setter:        l.weber@alpen-energie.ch / Test@2026!setter')
  console.log('    Setter:        s.meier@alpen-energie.ch / Test@2026!setter2')
  console.log('    Berater:       t.mueller@alpen-energie.ch / Test@2026!berater')
  console.log('    Berater:       m.bernasconi@alpen-energie.ch / Test@2026!berater2')
  console.log('    Innendienst:   s.brunner@alpen-energie.ch / Test@2026!innendienst')
  console.log('    Bau:           r.keller@alpen-energie.ch / Test@2026!bau')
  console.log('    Buchhaltung:   a.steiner@alpen-energie.ch / Test@2026!buchhaltung')
  console.log('    Leadkontrolle: p.fischer@alpen-energie.ch / Test@2026!leadkontrolle\n')
  console.log('  TEST COMPANY AG (slug: test-company):')
  console.log('    Super User:    admin@test-company.ch / Super@Test2026!\n')
}

main().catch((err) => {
  console.error('\n❌ Seed failed:', err)
  process.exit(1)
})
