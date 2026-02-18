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

function brizzAliases(field: string): string[] {
  const parts = field.split('_')
  const camel = 'brizz' + parts.map((p) => p[0].toUpperCase() + p.slice(1)).join('')
  const dot = 'brizz.' + parts.join('.')
  const underscore = 'brizz.' + field
  return [...new Set([camel, dot, underscore])]
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
  for (const key of brizzAliases(field)) {
    const val = props[key]
    if (typeof val === 'string' && val) return val
  }
  return undefined
}

function lookupBrizzSeverity(props: Record<string, unknown>): number | undefined {
  for (const key of brizzAliases('severity_number')) {
    const val = props[key]
    if (typeof val === 'number' && val >= 0 && val <= 24) return val
  }
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
    service_name: settings.serviceName || lookupBrizzField(props, 'service_name') || 'unknown',
    session_id: lookupBrizzField(props, 'session_id') || '',
    timestamp: toISOTimestamp(payload.timestamp),
    source: 'segment',
    environment: settings.environment || lookupBrizzField(props, 'environment'),
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
