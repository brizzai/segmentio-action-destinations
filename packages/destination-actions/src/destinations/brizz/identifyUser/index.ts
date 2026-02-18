import type { ActionDefinition } from '@segment/actions-core'
import type { Settings } from '../generated-types'
import type { Payload } from './generated-types'
import { sendEvent } from '../utils'

const action: ActionDefinition<Settings, Payload> = {
  title: 'Identify User',
  description: 'Send Segment identify events to Brizz as user identification events.',
  defaultSubscription: 'type = "identify"',
  fields: {
    traits: {
      label: 'User Traits',
      description: 'The user traits from the identify call.',
      type: 'object',
      required: false,
      default: { '@path': '$.traits' },
      additionalProperties: true
    },
    userId: {
      label: 'User ID',
      description: 'The user ID associated with the event.',
      type: 'string',
      required: false,
      default: { '@path': '$.userId' }
    },
    anonymousId: {
      label: 'Anonymous ID',
      description: 'The anonymous ID associated with the event.',
      type: 'string',
      required: false,
      default: { '@path': '$.anonymousId' }
    },
    timestamp: {
      label: 'Timestamp',
      description: 'The timestamp of the event.',
      type: 'datetime',
      required: false,
      default: { '@path': '$.timestamp' }
    },
    messageId: {
      label: 'Message ID',
      description: 'The Segment message ID for deduplication.',
      type: 'string',
      required: false,
      default: { '@path': '$.messageId' }
    },
    context: {
      label: 'Event Context',
      description: 'The Segment event context (page, userAgent, etc.).',
      type: 'object',
      required: false,
      default: { '@path': '$.context' },
      additionalProperties: true
    },
    enable_batching: {
      label: 'Enable Batching',
      type: 'boolean',
      default: true,
      unsafe_hidden: true
    },
    batch_size: {
      label: 'Batch Size',
      description: 'Maximum number of events to include in each batch. Actual batch sizes may be lower.',
      type: 'number',
      default: 100,
      unsafe_hidden: true
    }
  },
  perform: (request, { payload, settings }) => {
    return sendEvent(
      request,
      settings,
      [payload],
      () => 'identify',
      (p) => p.traits
    )
  },
  performBatch: (request, { payload, settings }) => {
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
