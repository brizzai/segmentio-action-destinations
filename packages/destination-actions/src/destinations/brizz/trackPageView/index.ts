import type { ActionDefinition } from '@segment/actions-core'
import type { Settings } from '../generated-types'
import type { Payload } from './generated-types'
import { sendEvent } from '../utils'

const action: ActionDefinition<Settings, Payload> = {
  title: 'Track Page View',
  description: 'Send Segment page events to Brizz as page view events.',
  defaultSubscription: 'type = "page"',
  fields: {
    name: {
      label: 'Page Name',
      description: 'Name of the page. Sent as "page.{name}" in the Brizz event name, or "page_view" if omitted.',
      type: 'string',
      required: false,
      default: { '@path': '$.name' }
    },
    category: {
      label: 'Page Category',
      description: 'Page category. Included in the Brizz event body alongside page properties.',
      type: 'string',
      required: false,
      default: { '@path': '$.category' }
    },
    properties: {
      label: 'Page Properties',
      description: 'Page properties (e.g. url, path, title, referrer). Sent as the Brizz event body.',
      type: 'object',
      required: false,
      default: { '@path': '$.properties' },
      additionalProperties: true
    },
    userId: {
      label: 'User ID',
      description: 'Authenticated user ID. Stored as the brizz.user_id attribute.',
      type: 'string',
      required: false,
      default: { '@path': '$.userId' }
    },
    anonymousId: {
      label: 'Anonymous ID',
      description: 'Device-level anonymous ID. Stored as the segment.anonymous_id attribute.',
      type: 'string',
      required: false,
      default: { '@path': '$.anonymousId' }
    },
    timestamp: {
      label: 'Timestamp',
      description: 'Event timestamp in ISO 8601 format. Defaults to the current time if not provided.',
      type: 'datetime',
      required: false,
      default: { '@path': '$.timestamp' }
    },
    messageId: {
      label: 'Message ID',
      description: 'Unique Segment message ID. Stored as the segment.message_id attribute.',
      type: 'string',
      required: false,
      default: { '@path': '$.messageId' }
    },
    context: {
      label: 'Event Context',
      description:
        'Segment event context. All fields are flattened into Brizz event attributes using dot notation (e.g. context.page.url becomes page.url).',
      type: 'object',
      required: false,
      default: { '@path': '$.context' },
      additionalProperties: true
    },
    enable_batching: {
      label: 'Enable Batching',
      description: 'When enabled, events are sent in batches to Brizz.',
      type: 'boolean',
      default: true,
      unsafe_hidden: true
    },
    batch_size: {
      label: 'Batch Size',
      description: 'Maximum number of events per batch.',
      type: 'number',
      default: 100,
      unsafe_hidden: true
    }
  },
  perform: (request, { settings, payload }) => {
    return sendEvent(
      request,
      settings,
      [payload],
      (p) => (p.name ? `page.${p.name}` : 'page_view'),
      (p) => ({ category: p.category, ...(p.properties ?? {}) })
    )
  },
  performBatch: (request, { settings, payload }) => {
    return sendEvent(
      request,
      settings,
      payload,
      (p) => (p.name ? `page.${p.name}` : 'page_view'),
      (p) => ({ category: p.category, ...(p.properties ?? {}) })
    )
  }
}

export default action
