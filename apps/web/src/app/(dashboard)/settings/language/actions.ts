'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/config';

/**
 * Server action: persist the user's locale preference to their profile.
 *
 * Called by the LanguageSwitcher client component. The middleware will
 * read this value on the next request and set the x-locale header so
 * that next-intl resolves the correct messages.
 */
export async function updateLocalePreference(locale: SupportedLocale): Promise<void> {
  // Validate that the locale is one of the supported values
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );

  // Get the current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Not authenticated');
  }

  // Update the profile's locale_preference column
  const { error } = await supabase
    .from('profiles')
    .update({ locale_preference: locale })
    .eq('id', user.id);

  if (error) {
    throw new Error(`Failed to update locale preference: ${error.message}`);
  }
}
