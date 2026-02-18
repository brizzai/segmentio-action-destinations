// Generated file. DO NOT MODIFY IT BY HAND.

export interface Settings {
  /**
   * Override the default Brizz telemetry endpoint. Only change this for self-hosted or staging environments.
   */
  baseUrl?: string
  /**
   * Your Brizz API Key found in the dashboard under Settings > API Keys.
   */
  apiKey: string
  /**
   * Application name sent as the Brizz service_name. If omitted, falls back to the serviceName property in the event payload.
   */
  serviceName?: string
  /**
   * Deployment environment (e.g. production, staging). If omitted, falls back to the environment property in the event payload.
   */
  environment?: string
}
