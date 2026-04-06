import { describe, it, expect } from 'vitest'
import {
  BrandTokensSchema,
  CreateTenantSchema,
  LoginSchema,
  ResetPasswordSchema,
  VerifyTotpSchema,
  CreateLeadSchema,
  CreateOfferSchema,
  CreateInvoiceSchema,
  CreateProjectSchema,
  CreateConnectorSchema,
} from '../schemas/index.js'

describe('BrandTokensSchema', () => {
  it('accepts valid brand tokens', () => {
    const result = BrandTokensSchema.safeParse({
      primary: '#1A56DB',
      secondary: '#1A1A1A',
      accent: '#F3A917',
      background: '#FFFFFF',
      surface: '#F9FAFB',
      textPrimary: '#111827',
      textSecondary: '#6B7280',
      font: 'Inter',
      fontUrl: null,
      radius: '8px',
      darkModeEnabled: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid hex colors', () => {
    const result = BrandTokensSchema.safeParse({
      primary: 'not-a-color',
      secondary: '#1A1A1A',
      accent: '#F3A917',
      background: '#FFFFFF',
      surface: '#F9FAFB',
      textPrimary: '#111827',
      textSecondary: '#6B7280',
      font: 'Inter',
      fontUrl: null,
      radius: '8px',
      darkModeEnabled: true,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid radius format', () => {
    const result = BrandTokensSchema.safeParse({
      primary: '#1A56DB',
      secondary: '#1A1A1A',
      accent: '#F3A917',
      background: '#FFFFFF',
      surface: '#F9FAFB',
      textPrimary: '#111827',
      textSecondary: '#6B7280',
      font: 'Inter',
      fontUrl: null,
      radius: '8em',
      darkModeEnabled: true,
    })
    expect(result.success).toBe(false)
  })
})

describe('CreateTenantSchema', () => {
  it('accepts valid tenant data', () => {
    const result = CreateTenantSchema.safeParse({
      name: 'Alpen Energie GmbH',
      slug: 'alpen-energie',
    })
    expect(result.success).toBe(true)
  })

  it('rejects slugs with uppercase', () => {
    const result = CreateTenantSchema.safeParse({
      name: 'Test',
      slug: 'Invalid-Slug',
    })
    expect(result.success).toBe(false)
  })

  it('rejects short names', () => {
    const result = CreateTenantSchema.safeParse({
      name: 'A',
      slug: 'valid-slug',
    })
    expect(result.success).toBe(false)
  })
})

describe('LoginSchema', () => {
  it('accepts valid credentials', () => {
    const result = LoginSchema.safeParse({
      email: 'test@example.com',
      password: 'Test1234!',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = LoginSchema.safeParse({
      email: 'not-an-email',
      password: 'Test1234!',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty password', () => {
    const result = LoginSchema.safeParse({
      email: 'test@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('ResetPasswordSchema', () => {
  it('accepts a strong password', () => {
    const result = ResetPasswordSchema.safeParse({
      password: 'MyStr0ng!Pass',
      confirmPassword: 'MyStr0ng!Pass',
    })
    expect(result.success).toBe(true)
  })

  it('rejects mismatched passwords', () => {
    const result = ResetPasswordSchema.safeParse({
      password: 'MyStr0ng!Pass',
      confirmPassword: 'Different1!',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password without uppercase', () => {
    const result = ResetPasswordSchema.safeParse({
      password: 'mystr0ng!pass',
      confirmPassword: 'mystr0ng!pass',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password without number', () => {
    const result = ResetPasswordSchema.safeParse({
      password: 'MyStrong!Pass',
      confirmPassword: 'MyStrong!Pass',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password without special character', () => {
    const result = ResetPasswordSchema.safeParse({
      password: 'MyStr0ngPasss',
      confirmPassword: 'MyStr0ngPasss',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password shorter than 12 characters', () => {
    const result = ResetPasswordSchema.safeParse({
      password: 'MyS0ng!Pa',
      confirmPassword: 'MyS0ng!Pa',
    })
    expect(result.success).toBe(false)
  })
})

describe('VerifyTotpSchema', () => {
  it('accepts a 6-digit code', () => {
    const result = VerifyTotpSchema.safeParse({ code: '123456' })
    expect(result.success).toBe(true)
  })

  it('rejects non-numeric codes', () => {
    const result = VerifyTotpSchema.safeParse({ code: 'abcdef' })
    expect(result.success).toBe(false)
  })

  it('rejects codes that are not 6 digits', () => {
    const result = VerifyTotpSchema.safeParse({ code: '12345' })
    expect(result.success).toBe(false)
  })
})

describe('CreateLeadSchema', () => {
  it('accepts valid lead data', () => {
    const result = CreateLeadSchema.safeParse({
      source: 'website',
      firstName: 'Max',
      lastName: 'Muster',
      email: 'max@example.ch',
    })
    expect(result.success).toBe(true)
  })

  it('requires source', () => {
    const result = CreateLeadSchema.safeParse({
      firstName: 'Max',
    })
    expect(result.success).toBe(false)
  })
})

describe('CreateOfferSchema', () => {
  it('accepts valid offer data', () => {
    const result = CreateOfferSchema.safeParse({
      title: 'PV-Anlage 15kWp',
      amountChf: 35000,
    })
    expect(result.success).toBe(true)
  })
})

describe('CreateInvoiceSchema', () => {
  it('accepts valid invoice data', () => {
    const result = CreateInvoiceSchema.safeParse({
      invoiceNumber: 'RE-2026-001',
      customerName: 'Hans Muster',
      amountChf: 30000,
      taxChf: 2310,
      totalChf: 32310,
      issuedAt: '2026-03-01',
      dueAt: '2026-04-01',
    })
    expect(result.success).toBe(true)
  })
})

describe('CreateProjectSchema', () => {
  it('accepts valid project data', () => {
    const result = CreateProjectSchema.safeParse({
      title: 'PV-Anlage Müller',
      customerName: 'Familie Müller',
    })
    expect(result.success).toBe(true)
  })
})

describe('CreateConnectorSchema', () => {
  it('accepts valid connector data', () => {
    const result = CreateConnectorSchema.safeParse({
      type: 'reonic',
      name: 'Reonic CRM',
      credentials: { apiKey: 'test-key' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid connector type', () => {
    const result = CreateConnectorSchema.safeParse({
      type: 'invalid',
      name: 'Bad Connector',
      credentials: {},
    })
    expect(result.success).toBe(false)
  })
})
