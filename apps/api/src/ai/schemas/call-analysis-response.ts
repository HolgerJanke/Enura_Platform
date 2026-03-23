import { z } from 'zod'

export const CallAnalysisResponseSchema = z.object({
  score_script: z.number().int().min(1).max(10),
  feedback_script: z.string().min(10),
  score_objection: z.number().int().min(1).max(10),
  feedback_objection: z.string().min(10),
  score_closing: z.number().int().min(1).max(10),
  feedback_closing: z.string().min(10),
  score_tone: z.number().int().min(1).max(10),
  feedback_tone: z.string().min(10),
  strengths: z.array(z.string()).min(1).max(5),
  suggestions: z.array(z.string()).min(1).max(5),
  summary: z.string().min(20),
})

export type CallAnalysisResponse = z.infer<typeof CallAnalysisResponseSchema>
