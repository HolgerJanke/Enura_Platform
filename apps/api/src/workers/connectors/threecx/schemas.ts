import { z } from 'zod'

// ---------------------------------------------------------------------------
// 3CX xAPI Recordings Schema (OData format)
// ---------------------------------------------------------------------------

export const ThreeCXCallTypeEnum = z.enum([
  'InboundExternal',
  'OutboundExternal',
  'Local',
])

export const ThreeCXRecordingSchema = z
  .object({
    Id: z.union([z.string(), z.number()]).transform(String),
    StartTime: z.string(),
    EndTime: z.string().nullish(),
    CallType: ThreeCXCallTypeEnum,
    FromDn: z.string().nullish(),
    FromCallerNumber: z.string().nullish(),
    FromDisplayName: z.string().nullish(),
    ToDn: z.string().nullish(),
    ToCallerNumber: z.string().nullish(),
    ToDisplayName: z.string().nullish(),
    RecordingUrl: z.string().nullish(),
    IsTranscribed: z.boolean().optional(),
  })
  .passthrough()

export type ThreeCXRecording = z.infer<typeof ThreeCXRecordingSchema>

// ---------------------------------------------------------------------------
// 3CX xAPI Users Schema (Extensions)
// ---------------------------------------------------------------------------

export const ThreeCXUserSchema = z
  .object({
    Id: z.union([z.string(), z.number()]).transform(String),
    Number: z.string(),
    FirstName: z.string(),
    LastName: z.string(),
    EmailAddress: z.string().nullish(),
  })
  .passthrough()

export type ThreeCXUser = z.infer<typeof ThreeCXUserSchema>
