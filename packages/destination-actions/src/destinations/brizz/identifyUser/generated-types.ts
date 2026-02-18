// Generated file. DO NOT MODIFY IT BY HAND.

export interface Payload {
  /**
   * The user traits from the identify call.
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
   * The Segment message ID.
   */
  messageId?: string
  /**
   * The Segment event context.
   */
  context?: {
    [k: string]: unknown
  }
  /**
   * When enabled, events are sent in batches to Brizz.
   */
  enable_batching?: boolean
  /**
   * Maximum number of events per batch.
   */
  batch_size?: number
}
