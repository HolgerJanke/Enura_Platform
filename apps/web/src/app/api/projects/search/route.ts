export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  // Tenant scope comes from the verified session, never client input.
  const companyId = session.companyId
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
