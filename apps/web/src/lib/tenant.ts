import { headers } from 'next/headers'
import {
  type BrandTokens,
  defaultBrandTokens,
  buildCSSVarString,
  brandTokensFromRow,
} from '@enura/types'

// ---------------------------------------------------------------------------
// Tenant context from middleware-injected headers (works in both modes)
// ---------------------------------------------------------------------------

export interface TenantContext {
  tenantId: string
  tenantSlug: string
  tenantName: string
  isHolding: boolean
  brandCSS: string
  userId: string
}

export function getTenantContext(): TenantContext {
  const headerStore = headers()
  const tenantId = headerStore.get('x-tenant-id') ?? ''
  const tenantSlug = headerStore.get('x-tenant-slug') ?? ''
  const tenantName = headerStore.get('x-tenant-name') ?? ''
  const isHolding = headerStore.get('x-is-holding') === 'true'
  const brandCSS =
    headerStore.get('x-brand-css') ?? buildCSSVarString(defaultBrandTokens)
  const userId = headerStore.get('x-user-id') ?? ''

  return { tenantId, tenantSlug, tenantName, isHolding, brandCSS, userId }
}

// ---------------------------------------------------------------------------
// Mock branding data (used when MOCK_AUTH=true or Supabase not connected)
// ---------------------------------------------------------------------------

const MOCK_TENANT_BRANDINGS: Record<string, BrandTokens> = {
  'alpen-energie': { ...defaultBrandTokens },
  'test-company': {
    ...defaultBrandTokens,
    primary: '#059669',
    accent: '#D97706',
  },
  admin: { ...defaultBrandTokens },
}

/**
 * Returns brand tokens from the mock data layer.
 * Used during Phase 1 development without Supabase.
 */
export function getMockBrandingForTenant(slug: string | null): BrandTokens {
  if (!slug) return defaultBrandTokens
  return MOCK_TENANT_BRANDINGS[slug] ?? defaultBrandTokens
}

// ---------------------------------------------------------------------------
// Supabase-backed tenant + branding resolution
// ---------------------------------------------------------------------------

interface TenantBrandingRow {
  primary_color: string
  secondary_color: string
  accent_color: string
  background_color: string
  surface_color: string
  text_primary: string
  text_secondary: string
  font_family: string
  font_url: string | null
  border_radius: string
  dark_mode_enabled: boolean
}

interface TenantRow {
  id: string
  slug: string
  name: string
  status: string
}

export interface ResolvedTenant {
  id: string
  slug: string
  name: string
  status: string
  branding: BrandTokens
}

/**
 * Fetches a tenant and its branding from Supabase by slug.
 *
 * @param supabase — an authenticated Supabase client (from middleware or server component)
 * @param slug — the tenant slug (extracted from subdomain)
 * @returns the resolved tenant with brand tokens, or null if not found / inactive
 */
export async function fetchTenantBySlug(
  supabase: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          eq: (
            column: string,
            value: string,
          ) => { single: <T>() => Promise<{ data: T | null; error: unknown }> }
          single: <T>() => Promise<{ data: T | null; error: unknown }>
        }
      }
    }
  },
  slug: string,
): Promise<ResolvedTenant | null> {
  // Fetch tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug, name, status')
    .eq('slug', slug)
    .eq('status', 'active')
    .single<TenantRow>()

  if (!tenant) return null

  // Fetch branding
  const { data: branding } = await supabase
    .from('tenant_brandings')
    .select(
      'primary_color, secondary_color, accent_color, background_color, surface_color, text_primary, text_secondary, font_family, font_url, border_radius, dark_mode_enabled',
    )
    .eq('tenant_id', tenant.id)
    .single<TenantBrandingRow>()

  const brandTokens = branding
    ? brandTokensFromRow(branding)
    : defaultBrandTokens

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status,
    branding: brandTokens,
  }
}

/**
 * Returns brand tokens for a tenant, supporting both mock and Supabase modes.
 *
 * - When called without a Supabase client, falls back to mock data.
 * - When called with a Supabase client, fetches from the database.
 */
export async function getBrandingForTenant(
  slug: string | null,
  supabase?: Parameters<typeof fetchTenantBySlug>[0],
): Promise<BrandTokens> {
  if (!slug) return defaultBrandTokens

  // If no Supabase client provided, use mock data
  if (!supabase) {
    return getMockBrandingForTenant(slug)
  }

  // Fetch from Supabase
  const resolved = await fetchTenantBySlug(supabase, slug)
  return resolved?.branding ?? defaultBrandTokens
}
