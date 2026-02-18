// Generated file. DO NOT MODIFY IT BY HAND.

export interface Payload {
  /**
   * The group ID from the group call.
   */
  groupId: string
  /**
   * The group traits from the group call.
   */
  traits?: {
    [k: string]: unknown
  }
  /**
   * The user ID associated with the event.
   */
  userId?: string
  /**
   * The anonymous ID associated with the event.
   */
  anonymousId?: string
  /**
   * The timestamp of the event.
   */
  timestamp?: string | number
  /**
   * The Segment message ID for deduplication.
   */
  messageId?: string
  /**
   * The Segment event context (page, userAgent, etc.).
   */
  context?: {
    [k: string]: unknown
  }
  enable_batching?: boolean
  /**
   * Maximum number of events to include in each batch. Actual batch sizes may be lower.
   */
  batch_size?: number
}
