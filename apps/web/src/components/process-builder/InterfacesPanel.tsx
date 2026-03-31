'use client'

import { useState, useCallback, useEffect } from 'react'
import type {
  ProcessStepInterfaceRow,
  ToolRegistryRow,
} from '@enura/types'
import { FieldMappingEditor } from './FieldMappingEditor'
import {
  addInterfaceAction,
  updateInterfaceAction,
  deleteInterfaceAction,
} from '@/app/(holding)/admin/processes/[id]/actions'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INTERFACE_TYPES = [
  { value: 'rest_pull', label: 'REST Pull' },
  { value: 'rest_push', label: 'REST Push' },
  { value: 'webhook_in', label: 'Webhook Eingehend' },
  { value: 'webhook_out', label: 'Webhook Ausgehend' },
  { value: 'file_in', label: 'Datei Eingang' },
  { value: 'file_out', label: 'Datei Ausgang' },
  { value: 'internal', label: 'Intern' },
] as const

const PROTOCOLS = [
  { value: 'https', label: 'HTTPS' },
  { value: 'sftp', label: 'SFTP' },
  { value: 's3', label: 'S3' },
  { value: 'internal', label: 'Intern' },
] as const

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

const RETRY_POLICIES = [
  { value: 'none', label: 'Keine' },
  { value: 'exponential_3x', label: 'Exponentiell (3x)' },
  { value: 'alert_manual', label: 'Alarm + Manuell' },
] as const

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InterfacesPanelProps {
  processId: string
  holdingId: string
  companyId: string | null
  stepId: string
  interfaces: ProcessStepInterfaceRow[]
  toolRegistry: ToolRegistryRow[]
  secrets: Array<{ id: string; name: string }>
}

// ---------------------------------------------------------------------------
// Single interface editor
// ---------------------------------------------------------------------------

interface InterfaceRowProps {
  iface: ProcessStepInterfaceRow
  processId: string
  toolRegistry: ToolRegistryRow[]
  secrets: Array<{ id: string; name: string }>
  onDeleted: (id: string) => void
}

function InterfaceRow({ iface, processId, toolRegistry, secrets, onDeleted }: InterfaceRowProps) {
  const [label, setLabel] = useState(iface.label)
  const [interfaceType, setInterfaceType] = useState(iface.interface_type)
  const [protocol, setProtocol] = useState(iface.protocol)
  const [toolRegistryId, setToolRegistryId] = useState(iface.tool_registry_id ?? '')
  const [endpoint, setEndpoint] = useState(iface.endpoint ?? '')
  const [httpMethod, setHttpMethod] = useState(iface.http_method ?? '')
  const [requestSchemaText, setRequestSchemaText] = useState(
    iface.request_schema ? JSON.stringify(iface.request_schema, null, 2) : '',
  )
  const [responseSchemaText, setResponseSchemaText] = useState(
    iface.response_schema ? JSON.stringify(iface.response_schema, null, 2) : '',
  )
  const [fieldMapping, setFieldMapping] = useState<Record<string, unknown>[]>(iface.field_mapping ?? [])
  const [secretRef, setSecretRef] = useState(iface.secret_ref ?? '')
  const [syncIntervalMin, setSyncIntervalMin] = useState<number | null>(iface.sync_interval_min)
  const [timeoutSec, setTimeoutSec] = useState(iface.timeout_sec)
  const [retryPolicy, setRetryPolicy] = useState(iface.retry_policy)
  const [triggerCondition, setTriggerCondition] = useState(iface.trigger_condition ?? '')
  const [isDeleting, setIsDeleting] = useState(false)

  // When tool registry selection changes, prefill endpoint + secret
  useEffect(() => {
    if (!toolRegistryId) return
    const tool = toolRegistry.find((t) => t.id === toolRegistryId)
    if (tool) {
      if (tool.base_url) setEndpoint(tool.base_url)
      if (tool.secret_ref) setSecretRef(tool.secret_ref)
    }
  }, [toolRegistryId, toolRegistry])

  const save = useCallback(async () => {
    let requestSchema: Record<string, unknown> | null = null
    let responseSchema: Record<string, unknown> | null = null

    try {
      if (requestSchemaText.trim()) {
        requestSchema = JSON.parse(requestSchemaText) as Record<string, unknown>
      }
    } catch {
      // Keep null on parse error
    }

    try {
      if (responseSchemaText.trim()) {
        responseSchema = JSON.parse(responseSchemaText) as Record<string, unknown>
      }
    } catch {
      // Keep null on parse error
    }

    await updateInterfaceAction({
      interfaceId: iface.id,
      processId,
      label,
      interfaceType,
      protocol,
      toolRegistryId: toolRegistryId || null,
      endpoint: endpoint || null,
      httpMethod: (httpMethod as typeof HTTP_METHODS[number]) || null,
      requestSchema,
      responseSchema,
      fieldMapping,
      secretRef: secretRef || null,
      syncIntervalMin,
      triggerCondition: triggerCondition || null,
      retryPolicy,
      timeoutSec,
    })
  }, [
    iface.id,
    processId,
    label,
    interfaceType,
    protocol,
    toolRegistryId,
    endpoint,
    httpMethod,
    requestSchemaText,
    responseSchemaText,
    fieldMapping,
    secretRef,
    syncIntervalMin,
    triggerCondition,
    retryPolicy,
    timeoutSec,
  ])

  const handleDelete = useCallback(async () => {
    setIsDeleting(true)
    const result = await deleteInterfaceAction(iface.id, processId)
    if (result.success) {
      onDeleted(iface.id)
    }
    setIsDeleting(false)
  }, [iface.id, processId, onDeleted])

  return (
    <div className={`rounded-md border border-gray-200 p-3 space-y-3 ${isDeleting ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between">
        <h5 className="text-sm font-medium text-gray-700">{label || 'Schnittstelle'}</h5>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
          aria-label="Schnittstelle entfernen"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Label */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Bezeichnung</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={save}
            className="block w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Typ</label>
          <select
            value={interfaceType}
            onChange={(e) => setInterfaceType(e.target.value as typeof interfaceType)}
            onBlur={save}
            className="block w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          >
            {INTERFACE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Tool registry selector */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tool-Registry</label>
          <select
            value={toolRegistryId}
            onChange={(e) => setToolRegistryId(e.target.value)}
            onBlur={save}
            className="block w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          >
            <option value="">Kein Tool</option>
            {toolRegistry.map((tool) => (
              <option key={tool.id} value={tool.id}>{tool.name}</option>
            ))}
          </select>
        </div>

        {/* Protocol */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Protokoll</label>
          <select
            value={protocol}
            onChange={(e) => setProtocol(e.target.value as typeof protocol)}
            onBlur={save}
            className="block w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          >
            {PROTOCOLS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Endpoint */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Endpoint</label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            onBlur={save}
            placeholder="https://..."
            className="block w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
          />
        </div>

        {/* HTTP Method */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">HTTP-Methode</label>
          <select
            value={httpMethod}
            onChange={(e) => setHttpMethod(e.target.value)}
            onBlur={save}
            className="block w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          >
            <option value="">-</option>
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Secret ref */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Secret</label>
          <select
            value={secretRef}
            onChange={(e) => setSecretRef(e.target.value)}
            onBlur={save}
            className="block w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          >
            <option value="">Kein Secret</option>
            {secrets.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Sync interval */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Sync-Intervall (Min.)</label>
          <input
            type="number"
            value={syncIntervalMin ?? ''}
            onChange={(e) => setSyncIntervalMin(e.target.value ? parseInt(e.target.value, 10) : null)}
            onBlur={save}
            min={0}
            className="block w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          />
        </div>

        {/* Timeout */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Timeout (Sek.)</label>
          <input
            type="number"
            value={timeoutSec}
            onChange={(e) => setTimeoutSec(parseInt(e.target.value, 10) || 30)}
            onBlur={save}
            min={1}
            className="block w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          />
        </div>

        {/* Retry policy */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Retry-Policy</label>
          <select
            value={retryPolicy}
            onChange={(e) => setRetryPolicy(e.target.value as typeof retryPolicy)}
            onBlur={save}
            className="block w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          >
            {RETRY_POLICIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Trigger condition */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="block text-xs font-medium text-gray-500 mb-1">Trigger-Bedingung</label>
          <input
            type="text"
            value={triggerCondition}
            onChange={(e) => setTriggerCondition(e.target.value)}
            onBlur={save}
            placeholder="z.B. status == 'completed'"
            className="block w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
          />
        </div>
      </div>

      {/* JSON Schema editors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Request-Schema (JSON)</label>
          <textarea
            value={requestSchemaText}
            onChange={(e) => setRequestSchemaText(e.target.value)}
            onBlur={save}
            rows={4}
            placeholder='{"type": "object", "properties": {...}}'
            className="block w-full rounded border border-gray-200 px-2 py-1.5 text-xs font-mono text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Response-Schema (JSON)</label>
          <textarea
            value={responseSchemaText}
            onChange={(e) => setResponseSchemaText(e.target.value)}
            onBlur={save}
            rows={4}
            placeholder='{"type": "object", "properties": {...}}'
            className="block w-full rounded border border-gray-200 px-2 py-1.5 text-xs font-mono text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Field mapping */}
      <FieldMappingEditor
        mappings={fieldMapping}
        onChange={(updated) => {
          setFieldMapping(updated)
          // Defer save
          setTimeout(save, 200)
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function InterfacesPanel({
  processId,
  holdingId,
  companyId,
  stepId,
  interfaces: initialInterfaces,
  toolRegistry,
  secrets,
}: InterfacesPanelProps) {
  const [interfaces, setInterfaces] = useState<ProcessStepInterfaceRow[]>(initialInterfaces)
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = useCallback(async () => {
    setIsAdding(true)
    const result = await addInterfaceAction({
      holdingId,
      companyId,
      processId,
      stepId,
      label: 'Neue Schnittstelle',
      interfaceType: 'rest_pull',
    })

    if (result.success && result.data) {
      setInterfaces((prev) => [...prev, result.data as unknown as ProcessStepInterfaceRow])
    }
    setIsAdding(false)
  }, [holdingId, companyId, processId, stepId])

  const handleDeleted = useCallback((id: string) => {
    setInterfaces((prev) => prev.filter((i) => i.id !== id))
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Schnittstellen</h4>
        <button
          type="button"
          onClick={handleAdd}
          disabled={isAdding}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Schnittstelle hinzufuegen
        </button>
      </div>

      {interfaces.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Keine Schnittstellen definiert.</p>
      ) : (
        <div className="space-y-3">
          {interfaces.map((iface) => (
            <InterfaceRow
              key={iface.id}
              iface={iface}
              processId={processId}
              toolRegistry={toolRegistry}
              secrets={secrets}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
