import type { ActionDefinition } from '@segment/actions-core'
import type { Settings } from '../generated-types'
import type { Payload } from './generated-types'
import { sendEvent } from '../utils'

const action: ActionDefinition<Settings, Payload> = {
  title: 'Track Group Event',
  description: 'Send Segment group events to Brizz.',
  defaultSubscription: 'type = "group"',
  fields: {
    groupId: {
      label: 'Group ID',
      description: 'The group identifier. Included as group_id in the Brizz event body.',
      type: 'string',
      required: true,
      default: { '@path': '$.groupId' }
    },
    traits: {
      label: 'Group Traits',
      description: 'Group traits (e.g. name, plan, employees). Sent as the Brizz event body alongside group_id.',
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
      () => 'group',
      (p) => ({ group_id: p.groupId, ...(p.traits ?? {}) })
    )
  },
  performBatch: (request, { settings, payload }) => {
    return sendEvent(
      request,
      settings,
      payload,
      () => 'group',
      (p) => ({ group_id: p.groupId, ...(p.traits ?? {}) })
    )
  }
}

export default action
