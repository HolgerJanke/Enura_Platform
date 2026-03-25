import { z } from 'zod'

export const CreateProjectSchema = z.object({
  leadId: z.string().uuid().optional(),
  offerId: z.string().uuid().optional(),
  beraterId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  customerName: z.string().min(1).max(200),
  addressStreet: z.string().max(200).optional(),
  addressZip: z.string().max(10).optional(),
  addressCity: z.string().max(100).optional(),
  phaseId: z.string().uuid().optional(),
  installationDate: z.string().optional(),
  notes: z.string().max(5000).optional(),
})

export const UpdateProjectSchema = z.object({
  phaseId: z.string().uuid().optional(),
  status: z.enum(['active', 'on_hold', 'completed', 'cancelled']).optional(),
  installationDate: z.string().nullable().optional(),
  notes: z.string().max(5000).optional(),
})

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>
