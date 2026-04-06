import { z } from 'zod'

export const GetCallsQuerySchema = z.object({
  teamMemberId: z.string().uuid().optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  status: z.enum(['answered', 'missed', 'voicemail', 'busy', 'failed']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export type GetCallsQuery = z.infer<typeof GetCallsQuerySchema>
