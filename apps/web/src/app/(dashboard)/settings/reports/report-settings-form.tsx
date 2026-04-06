'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { TenantSettingsRow } from '@enura/types'
import { saveReportSettingsAction, triggerManualReportAction } from './actions'

type Props = {
  settings: TenantSettingsRow | null
}

const TIMEZONE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'Europe/Zurich', label: 'Europe/Zurich (MEZ/MESZ)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (MEZ/MESZ)' },
  { value: 'UTC', label: 'UTC' },
]

export function ReportSettingsForm({ settings }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [reportSendTime, setReportSendTime] = useState(settings?.report_send_time ?? '07:00')
  const [reportTimezone, setReportTimezone] = useState(settings?.report_timezone ?? 'Europe/Zurich')
  const [reportRecipientsAll, setReportRecipientsAll] = useState(settings?.report_recipients_all ?? false)
  const [stalledProjectDays, setStalledProjectDays] = useState(settings?.stalled_project_days ?? 7)
  const [unworkedLeadHours, setUnworkedLeadHours] = useState(settings?.unworked_lead_hours ?? 24)
  const [maxWhisperUsdMonthly, setMaxWhisperUsdMonthly] = useState(
    settings?.max_whisper_usd_monthly ? Number(settings.max_whisper_usd_monthly) : 100
  )

  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [triggerSuccess, setTriggerSuccess] = useState(false)
  const [triggerError, setTriggerError] = useState<string | null>(null)

  const handleSave = useCallback(() => {
    setSaveError(null)
    setSaveSuccess(false)

    startTransition(async () => {
      const result = await saveReportSettingsAction({
        reportSendTime,
        reportTimezone,
        reportRecipientsAll,
        stalledProjectDays,
        unworkedLeadHours,
        maxWhisperUsdMonthly,
      })

      if (result.error) {
        setSaveError(result.error)
      } else {
        setSaveSuccess(true)
        router.refresh()
      }
    })
  }, [reportSendTime, reportTimezone, reportRecipientsAll, stalledProjectDays, unworkedLeadHours, maxWhisperUsdMonthly, router])

  const handleTriggerReport = useCallback(() => {
    setTriggerError(null)
    setTriggerSuccess(false)

    startTransition(async () => {
      const result = await triggerManualReportAction()
      if (result.error) {
        setTriggerError(result.error)
      } else {
        setTriggerSuccess(true)
      }
    })
  }, [])

  const clearFeedback = useCallback(() => {
    setSaveSuccess(false)
    setSaveError(null)
  }, [])

  const inputClasses = 'w-full rounded-brand border border-gray-300 bg-brand-background px-3 py-2 text-sm text-brand-text-primary placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2'
  const ringStyle = { '--tw-ring-color': 'var(--brand-primary)' } as React.CSSProperties

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-brand-text-primary">
          Berichtseinstellungen
        </h1>
        <p className="text-brand-text-secondary mt-1">
          Konfigurieren Sie den taeglichen Bericht und Warnschwellen.
        </p>
      </div>

      {/* Send Settings */}
      <div className="bg-brand-surface rounded-brand border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-medium text-brand-text-primary mb-4">Versand</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Send time */}
          <div>
            <label htmlFor="report-send-time" className="block text-sm font-medium text-brand-text-primary mb-1.5">
              Sendezeit
            </label>
            <input
              id="report-send-time"
              type="time"
              value={reportSendTime}
              onChange={(e) => { setReportSendTime(e.target.value); clearFeedback() }}
              className={inputClasses}
              style={ringStyle}
            />
            <p className="text-xs text-brand-text-secondary mt-1">
              Der Bericht wird taeglich zu dieser Uhrzeit versendet.
            </p>
          </div>

          {/* Timezone */}
          <div>
            <label htmlFor="report-timezone" className="block text-sm font-medium text-brand-text-primary mb-1.5">
              Zeitzone
            </label>
            <select
              id="report-timezone"
              value={reportTimezone}
              onChange={(e) => { setReportTimezone(e.target.value); clearFeedback() }}
              className={inputClasses}
              style={ringStyle}
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Recipients */}
        <div className="mt-5">
          <label className="block text-sm font-medium text-brand-text-primary mb-2">
            Empfaenger
          </label>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="recipients"
                checked={!reportRecipientsAll}
                onChange={() => { setReportRecipientsAll(false); clearFeedback() }}
                className="h-4 w-4 border-gray-300"
                style={{ accentColor: 'var(--brand-primary)' }}
              />
              <span className="text-sm text-brand-text-primary">Nur berechtigte Benutzer</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="recipients"
                checked={reportRecipientsAll}
                onChange={() => { setReportRecipientsAll(true); clearFeedback() }}
                className="h-4 w-4 border-gray-300"
                style={{ accentColor: 'var(--brand-primary)' }}
              />
              <span className="text-sm text-brand-text-primary">Alle Benutzer</span>
            </label>
          </div>
          <p className="text-xs text-brand-text-secondary mt-1">
            &quot;Nur berechtigte Benutzer&quot; sendet den Bericht an Geschaeftsfuehrung und Teamleiter.
          </p>
        </div>
      </div>

      {/* Warning Thresholds */}
      <div className="bg-brand-surface rounded-brand border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-medium text-brand-text-primary mb-4">Warnschwellen</h2>
        <p className="text-sm text-brand-text-secondary mb-5">
          Der taegliche Bericht hebt Metriken hervor, die diese Schwellenwerte ueberschreiten.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Stalled projects */}
          <div>
            <label htmlFor="stalled-project-days" className="block text-sm font-medium text-brand-text-primary mb-1.5">
              Stagnierte Projekte (Tage)
            </label>
            <input
              id="stalled-project-days"
              type="number"
              min={1}
              max={365}
              value={stalledProjectDays}
              onChange={(e) => { setStalledProjectDays(Number(e.target.value)); clearFeedback() }}
              className={inputClasses}
              style={ringStyle}
            />
            <p className="text-xs text-brand-text-secondary mt-1">
              Warnung, wenn ein Projekt laenger als X Tage in einer Phase stagniert.
            </p>
          </div>

          {/* Unworked leads */}
          <div>
            <label htmlFor="unworked-lead-hours" className="block text-sm font-medium text-brand-text-primary mb-1.5">
              Unbearbeitete Leads (Stunden)
            </label>
            <input
              id="unworked-lead-hours"
              type="number"
              min={1}
              max={720}
              value={unworkedLeadHours}
              onChange={(e) => { setUnworkedLeadHours(Number(e.target.value)); clearFeedback() }}
              className={inputClasses}
              style={ringStyle}
            />
            <p className="text-xs text-brand-text-secondary mt-1">
              Warnung, wenn ein Lead laenger als X Stunden nicht kontaktiert wurde.
            </p>
          </div>

          {/* Max Whisper cost */}
          <div>
            <label htmlFor="max-whisper-usd" className="block text-sm font-medium text-brand-text-primary mb-1.5">
              Max. Transkription/Monat (USD)
            </label>
            <input
              id="max-whisper-usd"
              type="number"
              min={0}
              max={10000}
              step={10}
              value={maxWhisperUsdMonthly}
              onChange={(e) => { setMaxWhisperUsdMonthly(Number(e.target.value)); clearFeedback() }}
              className={inputClasses}
              style={ringStyle}
            />
            <p className="text-xs text-brand-text-secondary mt-1">
              Monatliches Budget für KI-Transkription. Bei Überschreitung wird die Transkription pausiert.
            </p>
          </div>
        </div>
      </div>

      {/* Feedback messages */}
      {saveError && (
        <div
          className="mb-6 flex items-center gap-2 rounded-brand border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span>{saveError}</span>
        </div>
      )}
      {saveSuccess && (
        <div
          className="mb-6 flex items-center gap-2 rounded-brand border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
          role="alert"
        >
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span>Einstellungen gespeichert.</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          {isPending && !triggerSuccess ? 'Wird gespeichert...' : 'Speichern'}
        </button>

        <button
          type="button"
          onClick={handleTriggerReport}
          disabled={isPending}
          className="rounded-brand border border-gray-300 bg-brand-background px-4 py-2.5 text-sm font-medium text-brand-text-primary hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {isPending && !saveSuccess ? 'Wird gesendet...' : 'Jetzt Bericht senden'}
        </button>
      </div>

      {/* Trigger feedback */}
      {triggerSuccess && (
        <div
          className="mt-4 flex items-center gap-2 rounded-brand border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
          role="alert"
        >
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span>Bericht wird generiert und versendet. Dies kann einige Minuten dauern.</span>
        </div>
      )}
      {triggerError && (
        <div
          className="mt-4 flex items-center gap-2 rounded-brand border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span>{triggerError}</span>
        </div>
      )}
    </>
  )
}
