export const PLATFORM_ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN ?? 'enura-group.com'

export const tenantUrl = (slug: string) => `${slug}.${PLATFORM_ROOT_DOMAIN}`
