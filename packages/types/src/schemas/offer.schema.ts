import { z } from 'zod'

export const CreateOfferSchema = z.object({
  leadId: z.string().uuid().optional(),
  beraterId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  amountChf: z.number().min(0),
  validUntil: z.string().optional(),
})

export const UpdateOfferSchema = z.object({
  status: z.enum(['draft', 'sent', 'negotiating', 'won', 'lost', 'expired']).optional(),
  amountChf: z.number().min(0).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
})

export type CreateOfferInput = z.infer<typeof CreateOfferSchema>
export type UpdateOfferInput = z.infer<typeof UpdateOfferSchema>
