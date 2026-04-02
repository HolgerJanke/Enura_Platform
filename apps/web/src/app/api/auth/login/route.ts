import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; password?: string }

    if (!body.email || !body.password) {
      return NextResponse.json({ error: 'E-Mail und Passwort erforderlich.' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
      return NextResponse.json({ error: 'Supabase nicht konfiguriert.' }, { status: 500 })
    }

    const cookieStore = cookies()
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // ignore
          }
        },
      },
    })

    const { error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    })

    if (error) {
      return NextResponse.json({ error: `E-Mail oder Passwort falsch. (${error.message})` }, { status: 401 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Serverfehler: ${msg}` }, { status: 500 })
  }
}
