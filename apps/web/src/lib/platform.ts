/**
 * Single source of truth for the platform root domain.
 *
 * This used to be hardcoded three different ways (`enura-group.com` in the
 * middleware, `platform.enura.ch` in the company wizard, `.platform.com` on the
 * tenant pages), so the subdomain a tenant was told to use did not match the one
 * the middleware actually resolved branding for.
 *
 * Read from NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN so client components can use it too.
 */
export const PLATFORM_ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN ?? 'enura-group.com'

/** Host for a tenant's branded subdomain, e.g. `alpen-energie.enura-group.com`. */
export function tenantHost(slug: string): string {
  return `${slug}.${PLATFORM_ROOT_DOMAIN}`
}

/** Full URL for a tenant's branded subdomain. */
export function tenantUrl(slug: string): string {
  return `https://${tenantHost(slug)}`
}
