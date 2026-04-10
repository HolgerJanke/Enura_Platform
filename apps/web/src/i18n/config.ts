/**
 * i18n configuration for the Enura Platform.
 *
 * SUPPORTED_LOCALES — every locale the platform knows about.
 * GO_LIVE_LOCALES   — locales that are fully translated and available to users.
 * DEFAULT_LOCALE    — used when no preference is set or the requested locale is unavailable.
 */

export const SUPPORTED_LOCALES = ['de', 'en', 'fr', 'it'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'de';

/**
 * Locales that have complete translations and are available in the
 * language switcher. French and Italian fall back to German until
 * their translation files are complete.
 */
export const GO_LIVE_LOCALES: SupportedLocale[] = ['de', 'en', 'fr', 'it'];

/**
 * Human-readable labels for each locale, used in the language switcher.
 */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Francais',
  it: 'Italiano',
};

/**
 * Flag emoji for each locale, used in the language switcher UI.
 */
export const LOCALE_FLAGS: Record<SupportedLocale, string> = {
  de: '\u{1F1E8}\u{1F1ED}', // Swiss flag
  en: '\u{1F1EC}\u{1F1E7}', // GB flag
  fr: '\u{1F1EB}\u{1F1F7}', // French flag
  it: '\u{1F1EE}\u{1F1F9}', // Italian flag
};

/**
 * Type guard to check whether a string is a valid SupportedLocale.
 */
/**
 * Per-locale configuration for date/time formatting.
 *
 * - datePattern:     Unicode date pattern used by date-fns / day.js formatting.
 * - intlLocale:      BCP 47 tag passed to Intl.DateTimeFormat / Intl.NumberFormat.
 * - dateTimeLocale:  BCP 47 tag used when formatting date + time together.
 *
 * Swiss locales (de-CH, fr-CH, it-CH) use the dd.MM.yyyy convention.
 */
export const LOCALE_CONFIG: Record<
  SupportedLocale,
  { datePattern: string; intlLocale: string; dateTimeLocale: string }
> = {
  de: {
    datePattern: 'dd.MM.yyyy',
    intlLocale: 'de-CH',
    dateTimeLocale: 'de-CH',
  },
  en: {
    datePattern: 'dd/MM/yyyy',
    intlLocale: 'en-GB',
    dateTimeLocale: 'en-GB',
  },
  fr: {
    datePattern: 'dd.MM.yyyy',
    intlLocale: 'fr-CH',
    dateTimeLocale: 'fr-CH',
  },
  it: {
    datePattern: 'dd.MM.yyyy',
    intlLocale: 'it-CH',
    dateTimeLocale: 'it-CH',
  },
};

/**
 * Type guard to check whether a string is a valid SupportedLocale.
 */
export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
