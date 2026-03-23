import { z } from 'zod'

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/

export const BrandTokensSchema = z.object({
  primary: z.string().regex(hexColorRegex, 'Must be a valid hex color'),
  secondary: z.string().regex(hexColorRegex, 'Must be a valid hex color'),
  accent: z.string().regex(hexColorRegex, 'Must be a valid hex color'),
  background: z.string().regex(hexColorRegex, 'Must be a valid hex color'),
  surface: z.string().regex(hexColorRegex, 'Must be a valid hex color'),
  textPrimary: z.string().regex(hexColorRegex, 'Must be a valid hex color'),
  textSecondary: z.string().regex(hexColorRegex, 'Must be a valid hex color'),
  font: z.string().min(1).max(100),
  fontUrl: z.string().url().nullable(),
  radius: z.string().regex(/^\d+px$/, 'Must be in format like "8px"'),
  darkModeEnabled: z.boolean(),
})

export type BrandTokensInput = z.infer<typeof BrandTokensSchema>
