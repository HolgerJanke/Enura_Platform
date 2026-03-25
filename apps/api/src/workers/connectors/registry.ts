import type { ConnectorBase } from './base.js'

const registry = new Map<string, ConnectorBase>()

export function registerConnector(connector: ConnectorBase): void {
  registry.set(connector.type, connector)
}

export function getConnectorImpl(type: string): ConnectorBase {
  const impl = registry.get(type)
  if (!impl) throw new Error(`No connector registered for type: ${type}`)
  return impl
}

export function getAllRegisteredTypes(): string[] {
  return Array.from(registry.keys())
}
