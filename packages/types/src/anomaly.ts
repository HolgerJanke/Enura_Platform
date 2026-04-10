// =============================================================================
// Enura Group Multi-Tenant BI Platform — Anomaly Types
// =============================================================================

export type AnomalyType =
  | 'setter_call_volume_drop'
  | 'setter_call_volume_spike'
  | 'reach_rate_drop'
  | 'appointment_rate_drop'
  | 'lead_ingestion_stopped'
  | 'project_phase_stuck'
  | 'invoice_overdue_spike'
  | 'connector_sync_failure'
  | 'call_quality_drop'

export type AnomalySeverity = 'critical' | 'warning' | 'info'

export interface Anomaly {
  id: string
  tenantId: string
  type: AnomalyType
  severity: AnomalySeverity
  entityId: string | null
  entityName: string | null
  metric: string
  currentValue: number
  baselineValue: number
  deviationPct: number
  message: string
  detectedAt: string
  resolvedAt: string | null
  isActive: boolean
}

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  setter_call_volume_drop: 'Anrufvolumen gesunken',
  setter_call_volume_spike: 'Anrufvolumen-Spitze',
  reach_rate_drop: 'Erreichbarkeitsrate gesunken',
  appointment_rate_drop: 'Terminquote gesunken',
  lead_ingestion_stopped: 'Lead-Eingang gestoppt',
  project_phase_stuck: 'Projekt blockiert',
  invoice_overdue_spike: 'Überfällige Rechnungen gestiegen',
  connector_sync_failure: 'Connector-Sync fehlgeschlagen',
  call_quality_drop: 'Anrufqualität gesunken',
}

export const ANOMALY_SEVERITY_LABELS: Record<AnomalySeverity, string> = {
  critical: 'Kritisch',
  warning: 'Warnung',
  info: 'Information',
}
