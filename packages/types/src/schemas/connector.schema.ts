import { z } from 'zod'

export const CreateConnectorSchema = z.object({
  type: z.enum(['reonic', '3cx', 'bexio', 'google_calendar', 'leadnotes', 'whatsapp', 'gmail']),
  name: z.string().min(1).max(100),
  credentials: z.record(z.unknown()),
  config: z.record(z.unknown()).default({}),
  syncIntervalMinutes: z.number().int().min(5).max(1440).default(15),
})

export const UpdateConnectorSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  credentials: z.record(z.unknown()).optional(),
  config: z.record(z.unknown()).optional(),
  status: z.enum(['active', 'paused', 'error', 'disconnected']).optional(),
  syncIntervalMinutes: z.number().int().min(5).max(1440).optional(),
})

export type CreateConnectorInput = z.infer<typeof CreateConnectorSchema>
export type UpdateConnectorInput = z.infer<typeof UpdateConnectorSchema>
