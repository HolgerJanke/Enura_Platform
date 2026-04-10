import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const processId = request.nextUrl.searchParams.get('processId')
  if (!processId) {
    return NextResponse.json({ steps: [] })
  }

  const supabase = createSupabaseServerClient()
  const { data } = await supabase
    .from('process_steps')
    .select('id, name, process_step_id, sort_order, description')
    .eq('process_id', processId)
    .order('sort_order')

  return NextResponse.json({ steps: data ?? [] })
}
