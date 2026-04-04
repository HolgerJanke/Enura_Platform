'use client';

import { useTransition } from 'react';
import {
  GO_LIVE_LOCALES,
  LOCALE_FLAGS,
  LOCALE_LABELS,
  type SupportedLocale,
} from '@/i18n/config';
import { updateLocalePreference } from '@/app/(dashboard)/settings/language/actions';

interface LanguageSwitcherProps {
  /** The currently active locale, passed from a server component. */
  currentLocale: SupportedLocale;
}

/**
 * Dropdown language switcher. Shows available (go-live) locales with flag
 * emojis. On change it persists the preference to the user's profile via
 * a server action and reloads the page so the new locale takes effect.
 */
export default function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
  const [isPending, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const locale = event.target.value as SupportedLocale;
    if (locale === currentLocale) return;

    startTransition(async () => {
      await updateLocalePreference(locale);
      // Full reload so the server re-reads the updated preference and
      // sets the x-locale header for next-intl.
      window.location.reload();
    });
  }

  return (
    <div className="relative inline-block">
      <label htmlFor="language-switcher" className="sr-only">
        Language
      </label>
      <select
        id="language-switcher"
        aria-label="Language"
        value={currentLocale}
        onChange={handleChange}
        disabled={isPending}
        className={[
          'appearance-none rounded-md border px-3 py-2 pr-8 text-sm',
          'border-[var(--brand-accent,#d1d5db)]',
          'bg-[var(--brand-surface,#ffffff)]',
          'text-[var(--brand-text-primary,#111827)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#1a56db)]',
          isPending ? 'opacity-50 cursor-wait' : 'cursor-pointer',
        ].join(' ')}
      >
        {GO_LIVE_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_FLAGS[locale]} {LOCALE_LABELS[locale]}
          </option>
        ))}
      </select>

      {/* Dropdown chevron */}
      <svg
        className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--brand-text-secondary,#6b7280)]"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}
