import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cron job: daily report generation for all active tenants.
 *
 * Assembles KPI data from kpi_snapshots, offers, calls, leads, projects,
 * and connectors into a structured report. Stores in daily_reports table.
 *
 * This route does NOT require Claude/AI — it generates a deterministic
 * structured report from the real data. The report_json uses the "sections"
 * format that the report detail page already supports.
 */

type Row = Record<string, unknown>

function fmtNum(n: number): string {
  return n.toLocaleString('de-CH')
}

function fmtChf(n: number): string {
  if (n >= 1_000_000) return `CHF ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `CHF ${Math.round(n).toLocaleString('de-CH')}`
  return `CHF ${n.toFixed(0)}`
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('de-CH', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).format(d)
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env['CRON_SECRET']}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createSupabaseServiceClient()
  const now = new Date()
  const today = now.toISOString().split('T')[0]!
  const yesterday = new Date(now.getTime() - 86_400_000)
  const yesterdayStr = yesterday.toISOString().split('T')[0]!
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000)

  const { data: companies } = await db
    .from('companies')
    .select('id, name')
    .eq('status', 'active')

  if (!companies || companies.length === 0) {
    return NextResponse.json({ success: true, message: 'No active companies' })
  }

  const results: Array<{ company: string; sections: number }> = []

  for (const c of (companies ?? []) as Row[]) {
    const companyId = c['id'] as string
    const companyName = (c['name'] as string) ?? 'Unbekannt'

    try {
      // ---------------------------------------------------------------
      // Gather data from real tables
      // ---------------------------------------------------------------

      // Offers overview
      const [
        { count: totalOffers },
        { count: wonCount },
        { count: lostCount },
        { count: draftCount },
        { count: sentCount },
      ] = await Promise.all([
        db.from('offers').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        db.from('offers').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'won'),
        db.from('offers').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'lost'),
        db.from('offers').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'draft'),
        db.from('offers').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'sent'),
      ])

      const tOffers = totalOffers ?? 0
      const wCount = wonCount ?? 0
      const lCount = lostCount ?? 0

      // Pipeline value
      const { data: pipelineData } = await db
        .from('offers')
        .select('amount_chf')
        .eq('company_id', companyId)
        .not('status', 'in', '("won","lost","expired")')

      const pipelineValue = (pipelineData ?? []).reduce(
        (s: number, r: Row) => s + (Number(r['amount_chf']) || 0), 0,
      )

      // Won revenue
      const { data: wonData } = await db
        .from('offers')
        .select('amount_chf')
        .eq('company_id', companyId)
        .eq('status', 'won')

      const wonRevenue = (wonData ?? []).reduce(
        (s: number, r: Row) => s + (Number(r['amount_chf']) || 0), 0,
      )

      const winRate = (wCount + lCount) > 0 ? wCount / (wCount + lCount) : 0

      // Calls (30 days)
      const { data: callsData } = await db
        .from('calls')
        .select('id, status, duration_seconds')
        .eq('company_id', companyId)
        .gte('started_at', thirtyDaysAgo.toISOString())

      const allCalls = (callsData ?? []) as Row[]
      const answeredCalls = allCalls.filter((c) => c['status'] === 'answered')
      const reachRate = allCalls.length > 0 ? answeredCalls.length / allCalls.length : 0
      const totalCallDuration = allCalls.reduce((s, c) => s + (Number(c['duration_seconds']) || 0), 0)

      // Leads
      const { count: totalLeads } = await db
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)

      const { count: newLeadsToday } = await db
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', `${today}T00:00:00`)

      // Projects
      const { count: totalProjects } = await db
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)

      const { count: activeProjects } = await db
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'active')

      // Active anomalies
      const { data: anomalies } = await db
        .from('anomalies')
        .select('type, severity, message')
        .eq('company_id', companyId)
        .eq('is_active', true)

      const activeAnomalies = (anomalies ?? []) as Row[]

      // Connectors status
      const { data: connectors } = await db
        .from('connectors')
        .select('display_name, status, last_synced_at')
        .eq('company_id', companyId)

      const connectorList = (connectors ?? []) as Row[]
      const healthyConnectors = connectorList.filter((c) => c['status'] === 'active')
      const errorConnectors = connectorList.filter((c) => c['status'] === 'error')

      // ---------------------------------------------------------------
      // Build report sections
      // ---------------------------------------------------------------

      const sections: Array<{ title: string; items: string[] }> = []

      // 1. Executive Summary
      const summaryItems: string[] = [
        `Berichtsdatum: ${fmtDate(now)}`,
        `Angebote gesamt: ${fmtNum(tOffers)} (${fmtNum(draftCount ?? 0)} Entwurf, ${fmtNum(sentCount ?? 0)} versendet, ${fmtNum(wCount)} gewonnen, ${fmtNum(lCount)} verloren)`,
        `Umsatz (gewonnen): ${fmtChf(wonRevenue)}`,
        `Pipeline-Wert (offene Angebote): ${fmtChf(pipelineValue)}`,
        `Abschlussquote: ${fmtPct(winRate)}`,
      ]
      sections.push({ title: 'Zusammenfassung', items: summaryItems })

      // 2. Vertrieb & Angebote
      const salesItems: string[] = [
        `${fmtNum(wCount)} Abschluesse bei ${fmtNum(tOffers)} Angeboten (${fmtPct(winRate)} Abschlussquote)`,
        `${fmtNum(draftCount ?? 0)} Angebote im Entwurf — Potential fuer Versand pruefen`,
        `Pipeline-Wert aktiver Angebote: ${fmtChf(pipelineValue)}`,
      ]
      if (winRate < 0.15 && tOffers > 50) {
        salesItems.push('WARNUNG Abschlussquote unter 15% — Qualitaet der Angebote ueberpruefen')
      }
      if ((draftCount ?? 0) > tOffers * 0.5) {
        salesItems.push('INFO Ueber 50% der Angebote sind noch im Entwurf')
      }
      sections.push({ title: 'Vertrieb & Angebote', items: salesItems })

      // 3. Telefonie
      if (allCalls.length > 0) {
        const avgDuration = answeredCalls.length > 0
          ? Math.round(totalCallDuration / answeredCalls.length)
          : 0
        const phoneItems: string[] = [
          `${fmtNum(allCalls.length)} Anrufe in den letzten 30 Tagen`,
          `Erreichbarkeit: ${fmtPct(reachRate)} (${fmtNum(answeredCalls.length)} beantwortet)`,
          `Durchschnittliche Anrufdauer: ${Math.floor(avgDuration / 60)}:${String(avgDuration % 60).padStart(2, '0')} Min.`,
          `Gesamte Anrufdauer: ${Math.round(totalCallDuration / 3600)} Stunden`,
        ]
        if (reachRate < 0.3) {
          phoneItems.push('WARNUNG Erreichbarkeit unter 30% — Anrufzeiten optimieren')
        }
        sections.push({ title: 'Telefonie (30 Tage)', items: phoneItems })
      }

      // 4. Leads
      const leadItems: string[] = [
        `${fmtNum(totalLeads ?? 0)} Leads gesamt`,
        `${fmtNum(newLeadsToday ?? 0)} neue Leads heute`,
      ]
      if ((newLeadsToday ?? 0) === 0) {
        leadItems.push('INFO Heute noch keine neuen Leads eingegangen')
      }
      sections.push({ title: 'Leads', items: leadItems })

      // 5. Projekte
      const projItems: string[] = [
        `${fmtNum(totalProjects ?? 0)} Projekte gesamt, davon ${fmtNum(activeProjects ?? 0)} aktiv`,
      ]
      sections.push({ title: 'Projekte', items: projItems })

      // 6. Anomalien & Warnungen
      if (activeAnomalies.length > 0) {
        const anomalyItems: string[] = []
        for (const a of activeAnomalies) {
          const sev = String(a['severity']).toUpperCase()
          const prefix = sev === 'CRITICAL' ? 'KRITISCH' : sev === 'WARNING' ? 'WARNUNG' : 'INFO'
          anomalyItems.push(`${prefix} ${a['message'] as string}`)
        }
        sections.push({ title: 'Aktive Anomalien', items: anomalyItems })
      }

      // 7. System-Status
      const sysItems: string[] = [
        `${fmtNum(connectorList.length)} Connectoren konfiguriert`,
        `${fmtNum(healthyConnectors.length)} aktiv / ${fmtNum(errorConnectors.length)} fehlerhaft`,
      ]
      for (const ec of errorConnectors) {
        sysItems.push(`WARNUNG Connector "${ec['display_name'] as string}" meldet Fehler`)
      }
      sections.push({ title: 'System-Status', items: sysItems })

      // ---------------------------------------------------------------
      // Store report
      // ---------------------------------------------------------------

      const reportJson = {
        title: `Tagesbericht ${companyName}`,
        date: today,
        sections,
      }

      const kpiData = {
        offers: { total: tOffers, won: wCount, lost: lCount, pipeline_value: pipelineValue, won_revenue: wonRevenue, win_rate: winRate },
        calls: { total_30d: allCalls.length, answered: answeredCalls.length, reach_rate: reachRate },
        leads: { total: totalLeads ?? 0, new_today: newLeadsToday ?? 0 },
        projects: { total: totalProjects ?? 0, active: activeProjects ?? 0 },
        anomalies_active: activeAnomalies.length,
      }

      const { error: upsertError } = await db.from('daily_reports').upsert({
        company_id: companyId,
        report_date: today,
        report_json: reportJson,
        kpi_data: kpiData,
        sent_to: [],
        sent_at: new Date().toISOString(),
      }, { onConflict: 'company_id,report_date' })

      if (upsertError) {
        console.error(`[daily-reports] Upsert error for ${companyName}:`, upsertError)
      }

      results.push({ company: companyName, sections: sections.length })
    } catch (err) {
      console.error(`[daily-reports] Error for ${companyName}:`, err)
      results.push({ company: companyName, sections: 0 })
    }
  }

  return NextResponse.json({ success: true, date: today, results })
}
