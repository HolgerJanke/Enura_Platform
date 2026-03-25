import { z } from 'zod'

// ---------------------------------------------------------------------------
// 3CX API Response Schemas
// ---------------------------------------------------------------------------

export const ThreeCXCallDirectionEnum = z.enum([
  'Inbound',
  'Outbound',
  'inbound',
  'outbound',
])

export const ThreeCXCallResultEnum = z.enum([
  'Answered',
  'Missed',
  'Voicemail',
  'Busy',
  'Failed',
  'answered',
  'missed',
  'voicemail',
  'busy',
  'failed',
  'NoAnswer',
  'NotAnswered',
])

export const ThreeCXCallSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    start_time: z.string(),
    end_time: z.string().nullish(),
    duration: z.number(),
    direction: ThreeCXCallDirectionEnum,
    result: ThreeCXCallResultEnum,
    caller_number: z.string().nullish(),
    callee_number: z.string().nullish(),
    extension: z.string().nullish(),
    recording_file: z.string().nullish(),
  })
  .passthrough()

export type ThreeCXCall = z.infer<typeof ThreeCXCallSchema>

export const ThreeCXExtensionSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    number: z.string(),
    first_name: z.string(),
    last_name: z.string(),
    email: z.string().nullish(),
  })
  .passthrough()

export type ThreeCXExtension = z.infer<typeof ThreeCXExtensionSchema>

export const ThreeCXCallLogResponseSchema = z.object({
  data: z.array(ThreeCXCallSchema),
  totalPages: z.number(),
})

export type ThreeCXCallLogResponse = z.infer<typeof ThreeCXCallLogResponseSchema>
