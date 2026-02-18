import type { ActionDefinition } from '@segment/actions-core'
import type { Settings } from '../generated-types'
import type { Payload } from './generated-types'
import { sendEvent } from '../utils'

const action: ActionDefinition<Settings, Payload> = {
  title: 'Track Group Event',
  description: 'Send Segment group events to Brizz as group association events.',
  defaultSubscription: 'type = "group"',
  fields: {
    groupId: {
      label: 'Group ID',
      description: 'The group ID from the group call.',
      type: 'string',
      required: true,
      default: { '@path': '$.groupId' }
    },
    traits: {
      label: 'Group Traits',
      description: 'The group traits from the group call.',
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
      () => 'group',
      (p) => ({ group_id: p.groupId, ...((p.traits as Record<string, unknown>) ?? {}) })
    )
  },
  performBatch: (request, { payload, settings }) => {
    return sendEvent(
      request,
      settings,
      payload,
      () => 'group',
      (p) => ({ group_id: p.groupId, ...((p.traits as Record<string, unknown>) ?? {}) })
    )
  }
}

export default action
