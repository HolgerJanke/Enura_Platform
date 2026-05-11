export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/session'
import { GO_LIVE_LOCALES, LOCALE_LABELS, LOCALE_FLAGS, DEFAULT_LOCALE } from '@/i18n/config'
import type { SupportedLocale } from '@/i18n/config'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import Link from 'next/link'

export default async function LanguageSettingsPage() {
  const session = await getSession()
  if (!session?.companyId) return null

  const currentLocale = (session.profile?.locale as SupportedLocale) ?? DEFAULT_LOCALE

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-2xl">
      <div>
        <Link href="/settings/connectors" className="inline-flex items-center gap-1 text-sm text-brand-text-secondary hover:text-brand-text-primary mb-4">
          &larr; Einstellungen
        </Link>
        <h1 className="text-2xl font-bold text-brand-text-primary">Sprache</h1>
        <p className="text-sm text-brand-text-secondary mt-1">
          Wählen Sie Ihre bevorzugte Sprache für die Plattform.
        </p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-brand-sm border border-gray-100 space-y-6">
        <div>
          <label className="text-sm font-medium text-brand-text-primary block mb-2">
            Aktuelle Sprache
          </label>
          <LanguageSwitcher currentLocale={currentLocale} />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-medium text-brand-text-primary mb-3">Verfügbare Sprachen</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {GO_LIVE_LOCALES.map((locale) => (
              <div
                key={locale}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  locale === currentLocale
                    ? 'border-brand-primary bg-brand-primary/5'
                    : 'border-gray-100'
                }`}
              >
                <span className="text-lg">{LOCALE_FLAGS[locale]}</span>
                <div>
                  <p className="text-sm font-medium text-brand-text-primary">{LOCALE_LABELS[locale]}</p>
                  {locale === currentLocale && (
                    <p className="text-[11px] text-brand-primary font-medium">Aktiv</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
