// =============================================================================
// Bexio Payment Matcher — Matches Bexio payments to liquidity event instances
// using amount similarity (within 5%) and date proximity.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { LiquidityEventInstanceRow, PaymentRow } from '@enura/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatchResult {
  totalPayments: number
  matchedCount: number
  skippedCount: number
  matches: MatchedPair[]
}

interface MatchedPair {
  paymentId: string
  eventInstanceId: string
  confidence: number
  amountDelta: number
  dateDeltaDays: number
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const AMOUNT_TOLERANCE = 0.05       // 5% tolerance for amount matching
const MIN_CONFIDENCE = 0.8          // Minimum confidence to auto-link
const LOOKBACK_DAYS = 90            // Only consider unmatched payments from last 90 days
const MAX_DATE_DELTA_DAYS = 30      // Maximum date proximity to consider

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysDiff(a: string, b: string): number {
  const dateA = new Date(a)
  const dateB = new Date(b)
  return Math.abs(Math.floor((dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24)))
}

function computeConfidence(amountRatio: number, dateDeltaDays: number): number {
  // Amount similarity: perfect match = 1.0, at tolerance boundary = 0.7
  const amountScore = 1 - Math.abs(1 - amountRatio) / AMOUNT_TOLERANCE * 0.3

  // Date proximity: same day = 1.0, at max delta = 0.5
  const dateScore = 1 - (dateDeltaDays / MAX_DATE_DELTA_DAYS) * 0.5

  // Weighted average: amount matters more
  return amountScore * 0.6 + dateScore * 0.4
}

// ---------------------------------------------------------------------------
// Main matcher function
// ---------------------------------------------------------------------------

export async function matchBexioPayments(
  supabase: SupabaseClient,
  companyId: string,
): Promise<MatchResult> {
  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - LOOKBACK_DAYS)
  const lookbackISO = lookbackDate.toISOString().split('T')[0]!

  // Fetch unmatched payments from last 90 days
  const { data: paymentsRaw, error: payErr } = await supabase
    .from('payments')
    .select('id, amount_chf, received_at, reference, notes')
    .eq('company_id', companyId)
    .gte('received_at', lookbackISO)
    .order('received_at', { ascending: true })

  if (payErr) {
    throw new Error(`Fehler beim Laden der Zahlungen: ${payErr.message}`)
  }

  const payments = (paymentsRaw ?? []) as unknown as PaymentRow[]

  // Fetch open (unmatched) liquidity event instances — events with no actual_date
  const { data: eventsRaw, error: evtErr } = await supabase
    .from('liquidity_event_instances')
    .select(`
      id, project_id, step_name, direction, plan_currency,
      plan_amount, plan_date, actual_date, actual_source
    `)
    .eq('company_id', companyId)
    .eq('marker_type', 'event')
    .is('actual_date', null)
    .not('plan_amount', 'is', null)
    .order('plan_date', { ascending: true })

  if (evtErr) {
    throw new Error(`Fehler beim Laden der Liquiditaetsereignisse: ${evtErr.message}`)
  }

  const events = (eventsRaw ?? []) as unknown as LiquidityEventInstanceRow[]

  // Build a set of already-matched event IDs to avoid double-matching
  const matchedEventIds = new Set<string>()
  const matches: MatchedPair[] = []
  let skippedCount = 0

  for (const payment of payments) {
    const paymentAmount = Math.abs(Number(payment.amount_chf))
    if (paymentAmount === 0) {
      skippedCount++
      continue
    }

    let bestMatch: { eventId: string; confidence: number; amountDelta: number; dateDeltaDays: number } | null = null

    for (const event of events) {
      if (matchedEventIds.has(event.id)) continue

      const planAmount = Math.abs(Number(event.plan_amount ?? 0))
      if (planAmount === 0) continue

      // Check amount similarity (within 5%)
      const amountRatio = paymentAmount / planAmount
      if (amountRatio < (1 - AMOUNT_TOLERANCE) || amountRatio > (1 + AMOUNT_TOLERANCE)) {
        continue
      }

      // Check date proximity
      const dateDelta = event.plan_date
        ? daysDiff(payment.received_at, event.plan_date)
        : MAX_DATE_DELTA_DAYS

      if (dateDelta > MAX_DATE_DELTA_DAYS) continue

      const confidence = computeConfidence(amountRatio, dateDelta)

      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = {
          eventId: event.id,
          confidence,
          amountDelta: paymentAmount - planAmount,
          dateDeltaDays: dateDelta,
        }
      }
    }

    // Only auto-link matches with confidence >= threshold
    if (bestMatch && bestMatch.confidence >= MIN_CONFIDENCE) {
      matchedEventIds.add(bestMatch.eventId)
      matches.push({
        paymentId: payment.id,
        eventInstanceId: bestMatch.eventId,
        confidence: bestMatch.confidence,
        amountDelta: bestMatch.amountDelta,
        dateDeltaDays: bestMatch.dateDeltaDays,
      })
    } else {
      skippedCount++
    }
  }

  // Write matches to the database
  const now = new Date().toISOString()

  for (const match of matches) {
    const payment = payments.find((p) => p.id === match.paymentId)
    if (!payment) continue

    const paymentAmount = Math.abs(Number(payment.amount_chf))
    const event = events.find((e) => e.id === match.eventInstanceId)
    const planAmount = event ? Math.abs(Number(event.plan_amount ?? 0)) : 0

    const { error: updateErr } = await supabase
      .from('liquidity_event_instances')
      .update({
        actual_date: payment.received_at.split('T')[0],
        actual_amount: String(paymentAmount),
        actual_currency: 'CHF',
        actual_source: 'bexio' as const,
        actual_source_ref: payment.id,
        matched_at: now,
        amount_deviation: String(paymentAmount - planAmount),
        date_deviation_days: match.dateDeltaDays,
      })
      .eq('id', match.eventInstanceId)

    if (updateErr) {
      throw new Error(
        `Fehler beim Aktualisieren von Ereignis ${match.eventInstanceId}: ${updateErr.message}`,
      )
    }
  }

  return {
    totalPayments: payments.length,
    matchedCount: matches.length,
    skippedCount,
    matches,
  }
}
