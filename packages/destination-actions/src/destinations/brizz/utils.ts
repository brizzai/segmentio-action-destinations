import type { RequestClient } from '@segment/actions-core'
import type { Settings } from './generated-types'

interface EventPayload {
  name?: string
  properties?: Record<string, unknown>
  traits?: Record<string, unknown>
  userId?: string | null
  anonymousId?: string | null
  timestamp?: string | number | null
  messageId?: string | null
  context?: Record<string, unknown> | null
  groupId?: string
  category?: string
}

const DEFAULT_BASE_URL = 'https://telemetry.brizz.dev'

interface BrizzEvent {
  name: string
  service_name: string
  session_id: string
  timestamp: string
  source: string
  environment?: string
  severity_number: number
  attributes: Record<string, unknown>
  body: unknown
}

function toISOTimestamp(value: string | number | null | undefined): string {
  if (!value) return new Date().toISOString()
  if (typeof value === 'number') return new Date(value).toISOString()
  return value
}

function deriveEventType(eventName: string): string {
  if (eventName === 'identify') return 'identify'
  if (eventName === 'group') return 'group'
  if (eventName.startsWith('page')) return 'page'
  return 'track'
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey))
    } else {
      result[fullKey] = value
    }
  }
  return result
}

const BRIZZ_FIELD_ALIASES: Record<string, string[]> = {
  sessionId: ['brizzSessionId', 'brizz.session.id', 'brizz.session_id'],
  serviceName: ['brizzServiceName', 'brizz.service.name', 'brizz.service_name'],
  environment: ['brizzEnvironment', 'brizz.environment'],
  severityNumber: ['brizzSeverityNumber', 'brizz.severity.number', 'brizz.severity_number'],
  severity: ['brizzSeverity', 'brizz.severity']
}

const SEVERITY_MAP: Record<string, number> = {
  trace: 1,
  debug: 5,
  info: 9,
  warn: 13,
  warning: 13,
  error: 17,
  fatal: 21,
  critical: 21
}

function lookupBrizzField(props: Record<string, unknown>, field: string): string | undefined {
  const aliases = BRIZZ_FIELD_ALIASES[field]
  if (!aliases) return undefined
  for (const key of aliases) {
    const val = props[key]
    if (typeof val === 'string' && val) return val
  }
  return undefined
}

function lookupBrizzSeverity(props: Record<string, unknown>): number | undefined {
  // 1. Explicit numeric severity via aliases
  for (const key of BRIZZ_FIELD_ALIASES.severityNumber) {
    const val = props[key]
    if (typeof val === 'number' && val >= 0 && val <= 24) return val
  }
  // 2. String level via aliases (e.g. "error" → 17)
  const level = lookupBrizzField(props, 'severity')
  if (level && SEVERITY_MAP[level.toLowerCase()] !== undefined) {
    return SEVERITY_MAP[level.toLowerCase()]
  }
  return undefined
}

export function mapToBrizzEvent(
  payload: EventPayload,
  settings: Settings,
  eventName: string,
  body: unknown
): BrizzEvent {
  // Flatten all context fields into attributes
  const attributes: Record<string, unknown> = payload.context ? flattenObject(payload.context) : {}

  // Add standard Segment/Brizz attributes
  if (payload.userId) attributes['brizz.user_id'] = payload.userId
  if (payload.anonymousId) attributes['segment.anonymous_id'] = payload.anonymousId
  if (payload.messageId) attributes['segment.message_id'] = payload.messageId
  attributes['segment.event_type'] = deriveEventType(eventName)

  // Extract special fields from properties/traits via lookup map
  const props = payload.properties || payload.traits || {}

  // Strip brizz-prefixed keys from body — they're destination metadata, not event data
  const cleanBody =
    body && typeof body === 'object' && !Array.isArray(body)
      ? Object.fromEntries(Object.entries(body as Record<string, unknown>).filter(([k]) => !k.startsWith('brizz')))
      : body

  return {
    name: eventName,
    service_name: settings.serviceName || lookupBrizzField(props, 'serviceName') || 'unknown',
    session_id: lookupBrizzField(props, 'sessionId') || '',
    timestamp: toISOTimestamp(payload.timestamp),
    source: 'segment',
    environment: settings.environment || lookupBrizzField(props, 'environment') || undefined,
    severity_number: lookupBrizzSeverity(props) ?? 9,
    attributes,
    body: cleanBody
  }
}

export function sendEvent(
  request: RequestClient,
  settings: Settings,
  payloads: EventPayload[],
  eventNameFn: (p: EventPayload) => string,
  bodyFn: (p: EventPayload) => unknown
) {
  const events = payloads.map((p) => mapToBrizzEvent(p, settings, eventNameFn(p), bodyFn(p)))
  const json = events.length === 1 ? events[0] : events

  const baseUrl = settings.baseUrl || DEFAULT_BASE_URL

  return request(`${baseUrl}/raw/events`, {
    method: 'post',
    json
  })
}
