import type { ActionDefinition } from '@segment/actions-core'
import type { Settings } from '../generated-types'
import type { Payload } from './generated-types'
import { sendEvent } from '../utils'

const action: ActionDefinition<Settings, Payload> = {
  title: 'Identify User',
  description: 'Send Segment identify events to Brizz.',
  defaultSubscription: 'type = "identify"',
  fields: {
    traits: {
      label: 'User Traits',
      description: 'User traits from the identify call (e.g. email, name, plan). Sent as the Brizz event body.',
      type: 'object',
      required: false,
      default: { '@path': '$.traits' },
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
        'Segment event context. Brizz extracts: context.page.url, context.page.path, context.page.referrer, context.page.title, context.userAgent, context.locale, context.ip. Note: context.sessionId is supported for backward compatibility but sessionId in properties is recommended.',
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
      () => 'identify',
      (p) => p.traits
    )
  },
  performBatch: (request, { settings, payload }) => {
    return sendEvent(
      request,
      settings,
      payload,
      () => 'identify',
      (p) => p.traits
    )
  }
}

export default action
