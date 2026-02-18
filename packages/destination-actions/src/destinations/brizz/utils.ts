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

export function mapToBrizzEvent(
  payload: EventPayload,
  settings: Settings,
  eventName: string,
  body: unknown
): BrizzEvent {
  const attributes: Record<string, unknown> = {}

  if (payload.userId) attributes['brizz.user_id'] = payload.userId
  if (payload.anonymousId) attributes['brizz.anonymous_id'] = payload.anonymousId
  if (payload.messageId) attributes['segment.message_id'] = payload.messageId
  attributes['segment.event_type'] = deriveEventType(eventName)

  if (payload.context && typeof payload.context === 'object') {
    const page = payload.context.page
    if (page && typeof page === 'object' && !Array.isArray(page)) {
      const p = page as Record<string, unknown>
      if (typeof p.url === 'string') attributes['page.url'] = p.url
      if (typeof p.path === 'string') attributes['page.path'] = p.path
      if (typeof p.referrer === 'string') attributes['page.referrer'] = p.referrer
      if (typeof p.title === 'string') attributes['page.title'] = p.title
    }
    if (typeof payload.context.userAgent === 'string') attributes['user_agent'] = payload.context.userAgent
    if (typeof payload.context.locale === 'string') attributes['locale'] = payload.context.locale
    if (typeof payload.context.ip === 'string') attributes['ip'] = payload.context.ip
  }

  return {
    name: eventName,
    service_name: settings.serviceName,
    session_id: payload.anonymousId || payload.userId || payload.messageId || 'unknown',
    timestamp: toISOTimestamp(payload.timestamp),
    source: 'segment',
    environment: settings.environment || undefined,
    severity_number: 9,
    attributes,
    body
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
