export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const companyId = request.nextUrl.searchParams.get('companyId') ?? ''

  if (!q || q.length < 2 || !companyId) {
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
