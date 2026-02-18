import type { RequestClient } from '@segment/actions-core'
import type { Settings } from './generated-types'

interface EventPayload {
  name?: string
  properties?: Record<string, unknown>
  traits?: Record<string, unknown>
  userId?: string | null
  anonymousId?: string | null
  timestamp?: string | null
  messageId?: string | null
  context?: Record<string, unknown> | null
  groupId?: string
  category?: string
}

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

export function mapToBrizzEvent(
  payload: EventPayload,
  settings: Settings,
  eventName: string,
  body: unknown
): BrizzEvent {
  const attributes: Record<string, unknown> = {}

  if (payload.userId) {
    attributes['brizz.user_id'] = payload.userId
  }
  if (payload.anonymousId) {
    attributes['brizz.anonymous_id'] = payload.anonymousId
  }

  if (payload.messageId) {
    attributes['segment.message_id'] = payload.messageId
  }
  attributes['segment.event_type'] =
    eventName === 'identify'
      ? 'identify'
      : eventName === 'group'
      ? 'group'
      : eventName.startsWith('page')
      ? 'page'
      : 'track'

  if (payload.context) {
    const page = payload.context.page as Record<string, string> | undefined
    if (page) {
      if (page.url) attributes['page.url'] = page.url
      if (page.path) attributes['page.path'] = page.path
      if (page.referrer) attributes['page.referrer'] = page.referrer
      if (page.title) attributes['page.title'] = page.title
    }
    if (payload.context.userAgent) {
      attributes['user_agent'] = payload.context.userAgent
    }
    if (payload.context.locale) {
      attributes['locale'] = payload.context.locale
    }
    if (payload.context.ip) {
      attributes['ip'] = payload.context.ip
    }
  }

  return {
    name: eventName,
    service_name: settings.serviceName,
    session_id: payload.anonymousId || payload.userId || payload.messageId || 'unknown',
    timestamp: payload.timestamp || new Date().toISOString(),
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

  return request(`${settings.baseUrl}/api/v1/telemetry/raw/events`, {
    method: 'post',
    json
  })
}
