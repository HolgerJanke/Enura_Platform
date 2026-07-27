export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/lib/session'

export async function GET(request: NextRequest) {
  // Middleware exempts /api/* from auth, so the session must be verified here.
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Tenant scope always comes from the verified session — never from the client.
  const companyId = session.companyId
  if (!companyId) {
    return NextResponse.json({ results: [] })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const supabase = createSupabaseServiceClient()
  const pattern = `%${q}%`

  const { data } = await supabase
    .from('projects')
    .select('id, title, customer_name, address_city, status, project_value')
    .eq('company_id', companyId)
    .or(`customer_name.ilike.${pattern},title.ilike.${pattern},address_city.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .limit(8)

  return NextResponse.json({ results: data ?? [] })
}
