import { getRequestConfig } from 'next-intl/server';
import { headers } from 'next/headers';
import deepmerge from 'deepmerge';
import { DEFAULT_LOCALE, isSupportedLocale } from './config';
import type { SupportedLocale } from './config';

/**
 * Loads a JSON message file for the given locale.
 * Returns an empty object if the file cannot be loaded.
 */
async function loadMessages(locale: SupportedLocale): Promise<Record<string, unknown>> {
  try {
    return (await import(`./messages/${locale}.json`)).default;
  } catch {
    return {};
  }
}

/**
 * next-intl request configuration.
 *
 * Locale resolution order:
 *   1. x-locale header (set by middleware from profile preference or subdomain)
 *   2. Falls back to DEFAULT_LOCALE ('de')
 *
 * Message loading strategy:
 *   - Always load the German (de) base messages first.
 *   - If the resolved locale is not 'de', load the locale-specific file
 *     and deep-merge it on top so that any missing keys fall back to German.
 */
export default getRequestConfig(async () => {
  const headerStore = await headers();
  const raw = headerStore.get('x-locale') ?? DEFAULT_LOCALE;
  const locale = isSupportedLocale(raw) ? raw : DEFAULT_LOCALE;

  // Always load the German base
  const baseMessages = await loadMessages('de');

  // Merge locale-specific overrides on top (if not already German)
  let messages: Record<string, unknown> = baseMessages;
  if (locale !== 'de') {
    const localeMessages = await loadMessages(locale);
    messages = deepmerge(baseMessages, localeMessages);
  }

  return {
    locale: locale as string,
    messages: messages as Record<string, Record<string, string>>,
  };
}) as ReturnType<typeof getRequestConfig>;
