import { z } from 'zod'

export const CoachingItemSchema = z.object({
  person: z.string(),
  observation: z.string(),
  recommendation: z.string(),
})

export const DailyReportResponseSchema = z.object({
  executive_summary: z.string().min(50),
  highlights: z.array(z.string()).max(5),
  concerns: z.array(z.string()).max(5),
  coaching: z.array(CoachingItemSchema).max(5),
  open_actions: z.array(z.string()).max(5),
  tomorrow_focus: z.string(),
})

export type CoachingItem = z.infer<typeof CoachingItemSchema>
export type DailyReportResponse = z.infer<typeof DailyReportResponseSchema>
