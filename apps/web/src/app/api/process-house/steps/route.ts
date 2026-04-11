import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const processId = request.nextUrl.searchParams.get('processId')
  if (!processId) {
    return NextResponse.json({ steps: [], phases: [] })
  }

  const supabase = createSupabaseServerClient()

  const [stepsRes, phasesRes] = await Promise.all([
    supabase
      .from('process_steps')
      .select('id, name, process_step_id, sort_order, description, responsible_roles, phase_id')
      .eq('process_id', processId)
      .order('sort_order'),
    supabase
      .from('process_phases')
      .select('id, name, description, sort_order, color')
      .eq('process_id', processId)
      .order('sort_order'),
  ])

  return NextResponse.json({
    steps: stepsRes.data ?? [],
    phases: phasesRes.data ?? [],
  })
}
