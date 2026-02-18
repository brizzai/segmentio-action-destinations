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
      description: 'The name of the page.',
      type: 'string',
      required: false,
      default: { '@path': '$.name' }
    },
    category: {
      label: 'Page Category',
      description: 'The category of the page.',
      type: 'string',
      required: false,
      default: { '@path': '$.category' }
    },
    properties: {
      label: 'Page Properties',
      description: 'The page properties.',
      type: 'object',
      required: false,
      default: { '@path': '$.properties' },
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
      description: 'The Segment message ID.',
      type: 'string',
      required: false,
      default: { '@path': '$.messageId' }
    },
    context: {
      label: 'Event Context',
      description: 'The Segment event context.',
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
