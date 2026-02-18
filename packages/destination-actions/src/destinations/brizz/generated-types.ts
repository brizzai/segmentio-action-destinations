// Generated file. DO NOT MODIFY IT BY HAND.

export interface Settings {
  /**
   * Override the default Brizz telemetry endpoint. Only change this for self-hosted or staging environments.
   */
  baseUrl?: string
  /**
   * Your Brizz Telemetry Key found in the dashboard under Settings > API Keys.
   */
  telemetryKey: string
  /**
   * Name of this service as it appears in Brizz. Used to group events from the same application.
   */
  serviceName: string
  /**
   * Deployment environment (e.g., production, staging, development).
   */
  environment?: string
}
