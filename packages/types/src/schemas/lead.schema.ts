import { z } from 'zod'

export const CreateLeadSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  addressStreet: z.string().max(200).optional(),
  addressZip: z.string().max(10).optional(),
  addressCity: z.string().max(100).optional(),
  addressCanton: z.string().max(2).optional(),
  source: z.enum(['website', 'referral', 'partner', 'advertising', 'cold_call', 'leadnotes', 'other']),
  setterId: z.string().uuid().optional(),
  notes: z.string().max(5000).optional(),
})

export const UpdateLeadSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'appointment_set', 'won', 'lost', 'invalid']).optional(),
  setterId: z.string().uuid().nullable().optional(),
  notes: z.string().max(5000).optional(),
})

export const GetLeadsQuerySchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'appointment_set', 'won', 'lost', 'invalid']).optional(),
  setterId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>
export type GetLeadsQuery = z.infer<typeof GetLeadsQuerySchema>
