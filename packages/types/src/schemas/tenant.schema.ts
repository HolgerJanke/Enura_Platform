import { z } from 'zod'
import { BrandTokensSchema } from './brand.schema.js'

export const CreateTenantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
  branding: BrandTokensSchema.optional(),
})

export const UpdateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  status: z.enum(['active', 'suspended', 'archived']).optional(),
})

export type CreateTenantInput = z.infer<typeof CreateTenantSchema>
export type UpdateTenantInput = z.infer<typeof UpdateTenantSchema>
