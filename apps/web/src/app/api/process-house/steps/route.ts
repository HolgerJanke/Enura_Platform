import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const processId = request.nextUrl.searchParams.get('processId')
  if (!processId) {
    return NextResponse.json({ steps: [], phases: [], projects: [] })
  }

  const supabase = createSupabaseServiceClient()

  const [stepsRes, phasesRes, instancesRes] = await Promise.all([
    supabase
      .from('process_steps')
      .select('id, name, process_step_id, sort_order, description, responsible_roles, phase_id, expected_output, criticality, rhythm')
      .eq('process_id', processId)
      .order('sort_order'),
    supabase
      .from('process_phases')
      .select('id, name, description, sort_order, color')
      .eq('process_id', processId)
      .order('sort_order'),
    // Fetch projects linked to this process
    supabase
      .from('project_process_instances')
      .select('id, project_id, status')
      .eq('process_id', processId)
      .eq('status', 'active')
      .limit(200),
  ])

  // Fetch project details for active instances
  const projectIds = ((instancesRes.data ?? []) as Array<{ project_id: string }>).map(i => i.project_id)
  let projects: Array<Record<string, unknown>> = []

  if (projectIds.length > 0) {
    const { data: projectData } = await supabase
      .from('projects')
      .select('id, title, customer_name, address_city, status, phase_id, created_at, project_value')
      .in('id', projectIds)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100)

    projects = (projectData ?? []) as Array<Record<string, unknown>>
  }

  // Fetch base currency from company_currency_settings
  // Need to get company_id from the process definition
  let baseCurrency = 'CHF'
  const { data: processDef } = await supabase
    .from('process_definitions')
    .select('company_id')
    .eq('id', processId)
    .single()

  if (processDef) {
    const companyId = (processDef as Record<string, unknown>)['company_id'] as string
    const { data: currencyData } = await supabase
      .from('company_currency_settings')
      .select('base_currency')
      .eq('company_id', companyId)
      .single()
    if (currencyData) {
      baseCurrency = (currencyData as Record<string, unknown>)['base_currency'] as string
    }
  }

  // Distribute projects across steps (simple round-robin based on project age)
  const steps = (stepsRes.data ?? []) as Array<Record<string, unknown>>
  const stepCount = steps.length

  const projectsByStep = new Map<string, Array<Record<string, unknown>>>()
  for (const step of steps) {
    projectsByStep.set(step['id'] as string, [])
  }

  // Assign each project to a step based on its relative age (older = further along)
  if (stepCount > 0) {
    for (let i = 0; i < projects.length; i++) {
      const proj = projects[i]!
      // Distribute based on creation date — older projects further along
      const created = new Date(proj['created_at'] as string)
      const ageMs = Date.now() - created.getTime()
      const ageDays = ageMs / (1000 * 60 * 60 * 24)
      // Map age to step index (0-90 days spread across steps)
      const stepIdx = Math.min(stepCount - 1, Math.floor((ageDays / 90) * stepCount))
      const stepId = steps[stepIdx]!['id'] as string
      projectsByStep.get(stepId)?.push(proj)
    }
  }

  return NextResponse.json({
    steps: stepsRes.data ?? [],
    phases: phasesRes.data ?? [],
    projectsByStep: Object.fromEntries(projectsByStep),
    baseCurrency,
  })
}
