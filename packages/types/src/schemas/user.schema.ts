import { z } from 'zod'

export const CreateUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  roleIds: z.array(z.string().uuid()).min(1),
})

export const ResetPasswordSchema = z.object({
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[A-Z]/, 'Muss einen Grossbuchstaben enthalten')
    .regex(/[0-9]/, 'Muss eine Zahl enthalten')
    .regex(/[^A-Za-z0-9]/, 'Muss ein Sonderzeichen enthalten'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passw\u00f6rter stimmen nicht \u00fcberein',
  path: ['confirmPassword'],
})

export const LoginSchema = z.object({
  email: z.string().email('Ung\u00fcltige E-Mail-Adresse'),
  password: z.string().min(1, 'Passwort ist erforderlich'),
})

export const VerifyTotpSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, 'Code muss 6 Ziffern enthalten'),
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type VerifyTotpInput = z.infer<typeof VerifyTotpSchema>
