// Generated file. DO NOT MODIFY IT BY HAND.

export interface Payload {
  /**
   * Name of the event (e.g. "Order Completed"). Sent as the Brizz event name.
   */
  name: string
  /**
   * Free-form event data. Sent as the Brizz event body.
   */
  properties?: {
    [k: string]: unknown
  }
  /**
   * Authenticated user ID. Stored as the brizz.user_id attribute.
   */
  userId?: string
  /**
   * Device-level anonymous ID. Stored as the segment.anonymous_id attribute.
   */
  anonymousId?: string
  /**
   * Event timestamp in ISO 8601 format. Defaults to the current time if not provided.
   */
  timestamp?: string | number
  /**
   * Unique Segment message ID. Stored as the segment.message_id attribute.
   */
  messageId?: string
  /**
   * Segment event context. Brizz extracts page info (context.page.url, context.page.path, context.page.referrer, context.page.title), context.userAgent, context.locale, and context.ip.
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
