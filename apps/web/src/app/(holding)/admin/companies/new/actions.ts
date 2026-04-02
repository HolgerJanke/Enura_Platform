'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { writeAuditLog } from '@/lib/audit'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireHoldingSession() {
  const session = await getSession()
  if (!session) throw new Error('Nicht angemeldet')
  if (!session.isHoldingAdmin) throw new Error('Kein Zugriff')
  if (!session.holdingId) {
    throw new Error('Kein Holding zugewiesen.')
  }
  return { session, holdingId: session.holdingId, userId: session.profile.id }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CreateCompanyInput = {
  name: string
  slug: string
  domain?: string | null
  address?: string | null
  city?: string | null
  zip?: string | null
  country?: string | null
  phone?: string | null
  email?: string | null
}

type SuperUserInvitationInput = {
  companyId: string
  email: string
  firstName: string
  lastName: string
}

// ---------------------------------------------------------------------------
// DEFAULT_ROLES — auto-seeded for every new company
// ---------------------------------------------------------------------------

const DEFAULT_ROLES: ReadonlyArray<{ key: string; label: string; description: string }> = [
  { key: 'super_user', label: 'Super User', description: 'Vollzugriff auf alle Unternehmensfunktionen' },
  { key: 'geschaeftsfuehrung', label: 'Geschaeftsfuehrung', description: 'Alle Module, alle Mitarbeiter, Coaching-Ansicht' },
  { key: 'teamleiter', label: 'Teamleiter', description: 'Team-KPIs (Setter oder Berater), kein Finanzmodul' },
  { key: 'setter', label: 'Setter', description: 'Eigene Anrufe, eigene Termine, eigene KPIs' },
  { key: 'berater', label: 'Berater', description: 'Eigene Pipeline, eigene Termine, eigene KPIs' },
  { key: 'innendienst', label: 'Innendienst', description: 'Planung, Projektphasen, IA-Status' },
  { key: 'bau', label: 'Bau / Montage', description: 'Zugewiesene Projekte, Installationstermine, Material' },
  { key: 'buchhaltung', label: 'Buchhaltung', description: 'Rechnungen, Cashflow, Zahlungen' },
  { key: 'leadkontrolle', label: 'Leadkontrolle', description: 'Alle Leads, Lead-Qualitaet, kein Finanzmodul' },
]

// ---------------------------------------------------------------------------
// DEFAULT_BRANDING — holding branding is inherited by default
// ---------------------------------------------------------------------------

const DEFAULT_BRANDING: Record<string, string | boolean | null> = {
  primary_color: null,
  secondary_color: null,
  accent_color: null,
  background_color: null,
  surface_color: null,
  text_primary: null,
  text_secondary: null,
  font_family: null,
  border_radius: null,
  logo_url: null,
  dark_mode_enabled: true,
}

// ---------------------------------------------------------------------------
// createCompany — creates company + auto-seeds roles, branding, settings
// ---------------------------------------------------------------------------

export async function createCompany(
  input: CreateCompanyInput,
): Promise<{ success: boolean; companyId?: string; error?: string }> {
  const { holdingId, userId } = await requireHoldingSession()
  const serviceClient = createSupabaseServiceClient()
  const supabase = createSupabaseServerClient()

  // Validate required fields
  if (!input.name.trim()) {
    return { success: false, error: 'Unternehmensname ist erforderlich.' }
  }
  if (!input.slug.trim()) {
    return { success: false, error: 'Subdomain (Slug) ist erforderlich.' }
  }

  // Validate slug format (lowercase, alphanumeric, hyphens)
  const slugRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/
  if (!slugRegex.test(input.slug)) {
    return {
      success: false,
      error: 'Subdomain darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.',
    }
  }

  // Check slug uniqueness
  const { data: existingSlug } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', input.slug)
    .maybeSingle()

  if (existingSlug) {
    return { success: false, error: 'Diese Subdomain ist bereits vergeben.' }
  }

  // Create the company
  const { data: newCompany, error: companyError } = await serviceClient
    .from('companies')
    .insert({
      holding_id: holdingId,
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      domain: input.domain?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      zip: input.zip?.trim() || null,
      country: input.country?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      status: 'active',
    })
    .select('id')
    .single()

  if (companyError || !newCompany) {
    return {
      success: false,
      error: `Unternehmen konnte nicht erstellt werden: ${companyError?.message ?? 'Unbekannter Fehler'}`,
    }
  }

  const companyId = newCompany.id as string

  // Auto-seed: Company roles
  const roleInserts = DEFAULT_ROLES.map((role) => ({
    company_id: companyId,
    key: role.key,
    label: role.label,
    description: role.description,
    is_system: true,
  }))

  await serviceClient.from('roles').insert(roleInserts)

  // Auto-seed: Company branding (empty overrides, inherits from holding)
  await serviceClient.from('company_branding').insert({
    company_id: companyId,
    holding_id: holdingId,
    ...DEFAULT_BRANDING,
  })

  // Auto-seed: Company settings (defaults)
  await serviceClient.from('company_settings').insert({
    company_id: companyId,
    holding_id: holdingId,
    connector_sync_enabled: true,
    daily_report_enabled: false,
    daily_report_time: '07:00',
    stalled_project_threshold_days: 14,
  })

  // Audit log
  await writeAuditLog({
    companyId,
    actorId: userId,
    action: 'company.created',
    tableName: 'companies',
    recordId: companyId,
    newValues: { name: input.name, slug: input.slug },
  })

  revalidatePath('/admin/companies')
  revalidatePath('/admin')

  return { success: true, companyId }
}

// ---------------------------------------------------------------------------
// sendSuperUserInvitation — creates invitation for the company's first super user
// ---------------------------------------------------------------------------

export async function sendSuperUserInvitation(
  input: SuperUserInvitationInput,
): Promise<{ success: boolean; error?: string }> {
  const { holdingId, userId } = await requireHoldingSession()
  const supabase = createSupabaseServerClient()

  // Validate email
  if (!input.email || !input.email.includes('@')) {
    return { success: false, error: 'Bitte geben Sie eine gueltige E-Mail-Adresse ein.' }
  }
  if (!input.firstName.trim()) {
    return { success: false, error: 'Vorname ist erforderlich.' }
  }
  if (!input.lastName.trim()) {
    return { success: false, error: 'Nachname ist erforderlich.' }
  }

  // Verify company belongs to holding
  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', input.companyId)
    .eq('holding_id', holdingId)
    .single()

  if (!company) {
    return { success: false, error: 'Ungueltiges Unternehmen.' }
  }

  // Check for existing invitation
  const { data: existingInvite } = await supabase
    .from('user_invitations')
    .select('id')
    .eq('email', input.email)
    .eq('company_id', input.companyId)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingInvite) {
    return { success: false, error: 'Eine Einladung fuer diese E-Mail-Adresse ist bereits ausstehend.' }
  }

  // Generate invitation token
  const token = crypto.randomUUID()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  // Create invitation record
  const { error: invError } = await supabase.from('user_invitations').insert({
    token,
    email: input.email.trim().toLowerCase(),
    company_id: input.companyId,
    holding_id: holdingId,
    role_key: 'super_user',
    role_label: 'Super User',
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    invited_by: userId,
    status: 'pending',
    expires_at: expiresAt.toISOString(),
  })

  if (invError) {
    return {
      success: false,
      error: `Einladung konnte nicht erstellt werden: ${invError.message}`,
    }
  }

  // TODO: Sende E-Mail via Resend mit Einladungslink
  // const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`
  // await resend.emails.send({ to: input.email, subject: '...', ... })

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] Super-User Einladung: ${input.email} — Token: ${token}`)
  }

  await writeAuditLog({
    companyId: input.companyId,
    actorId: userId,
    action: 'super_user.invited',
    tableName: 'user_invitations',
    recordId: token,
    newValues: {
      email: input.email,
      company: company.name,
      role: 'super_user',
    },
  })

  revalidatePath('/admin/companies')
  revalidatePath(`/admin/companies/${input.companyId}`)

  return { success: true }
}
