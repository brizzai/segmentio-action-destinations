// Generated file. DO NOT MODIFY IT BY HAND.

export interface Settings {
  /**
   * Your Brizz base URL (e.g., https://gateway.yourdomain.com). This is the same base URL used in Brizz SDKs.
   */
  baseUrl: string
  /**
   * Your Brizz Telemetry Key. Found in the Brizz dashboard under Settings > Telemetry Keys. Starts with btk_.
   */
  telemetryKey: string
  /**
   * The name of this service as it will appear in Brizz. Used to group events and identify the source application.
   */
  serviceName: string
  /**
   * The deployment environment (e.g., production, staging, development). Optional.
   */
  environment?: string
}
