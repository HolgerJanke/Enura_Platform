/**
 * Generate a secure temporary password that meets all complexity requirements:
 * - 16 characters
 * - At least 1 uppercase, 1 lowercase, 1 digit, 1 special character
 */
export function generateTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const special = '!@#$%&*+-='

  // Ensure at least one of each type
  const required = [
    upper[Math.floor(Math.random() * upper.length)]!,
    upper[Math.floor(Math.random() * upper.length)]!,
    lower[Math.floor(Math.random() * lower.length)]!,
    lower[Math.floor(Math.random() * lower.length)]!,
    digits[Math.floor(Math.random() * digits.length)]!,
    digits[Math.floor(Math.random() * digits.length)]!,
    special[Math.floor(Math.random() * special.length)]!,
    special[Math.floor(Math.random() * special.length)]!,
  ]

  // Fill remaining with random from all chars
  const all = upper + lower + digits + special
  while (required.length < 16) {
    required.push(all[Math.floor(Math.random() * all.length)]!)
  }

  // Shuffle using Fisher-Yates
  for (let i = required.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = required[i]!
    required[i] = required[j]!
    required[j] = temp
  }

  return required.join('')
}
