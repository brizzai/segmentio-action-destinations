import type { ActionDefinition } from '@segment/actions-core'
import type { Settings } from '../generated-types'
import type { Payload } from './generated-types'
import { sendEvent } from '../utils'

const action: ActionDefinition<Settings, Payload> = {
  title: 'Track Event',
  description: 'Send Segment track events to Brizz as custom events.',
  defaultSubscription: 'type = "track"',
  fields: {
    name: {
      label: 'Event Name',
      description: 'Name of the event (e.g. "Order Completed"). Sent as the Brizz event name.',
      type: 'string',
      required: true,
      default: { '@path': '$.event' }
    },
    properties: {
      label: 'Event Properties',
      description: 'Free-form event data. Sent as the Brizz event body.',
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
      (p) => p.name ?? 'unknown',
      (p) => p.properties
    )
  },
  performBatch: (request, { settings, payload }) => {
    return sendEvent(
      request,
      settings,
      payload,
      (p) => p.name ?? 'unknown',
      (p) => p.properties
    )
  }
}

export default action
