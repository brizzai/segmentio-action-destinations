import { DestinationDefinition, defaultValues } from '@segment/actions-core'
import type { Settings } from './generated-types'

import trackEvent from './trackEvent'
import identifyUser from './identifyUser'
import trackPageView from './trackPageView'
import trackGroupEvent from './trackGroupEvent'

const destination: DestinationDefinition<Settings> = {
  name: 'Brizz',
  slug: 'actions-brizz',
  mode: 'cloud',
  description: 'Send Segment events to Brizz for observability, analytics, and session replay.',

  authentication: {
    scheme: 'custom',
    fields: {
      baseUrl: {
        label: 'Base URL',
        description:
          'Override the default Brizz telemetry endpoint. Only change this for self-hosted or staging environments.',
        type: 'string',
        required: false,
        format: 'uri',
        default: 'https://telemetry.brizz.dev'
      },
      apiKey: {
        label: 'API Key',
        description: 'Your Brizz API Key found in the dashboard under Settings > API Keys.',
        type: 'password',
        required: true
      },
      serviceName: {
        label: 'Service Name',
        description: 'Name of this service as it appears in Brizz. Used to group events from the same application.',
        type: 'string',
        required: true,
        default: 'my-app'
      },
      environment: {
        label: 'Environment',
        description: 'Deployment environment (e.g., production, staging, development).',
        type: 'string',
        required: false,
        default: 'production'
      }
    },
    testAuthentication: async (request, { settings }) => {
      const baseUrl = settings.baseUrl || 'https://telemetry.brizz.dev'
      await request(`${baseUrl}/raw/events`, {
        method: 'post',
        json: {
          name: 'segment.connection_test',
          service_name: settings.serviceName,
          session_id: 'segment-connection-test',
          timestamp: new Date().toISOString(),
          source: 'segment',
          severity_number: 9,
          attributes: {},
          body: { test: true }
        }
      })
    }
  },

  extendRequest({ settings }) {
    return {
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  },

  actions: {
    trackEvent,
    identifyUser,
    trackPageView,
    trackGroupEvent
  },

  presets: [
    {
      name: 'Track Event',
      subscribe: 'type = "track"',
      partnerAction: 'trackEvent',
      mapping: defaultValues(trackEvent.fields),
      type: 'automatic'
    },
    {
      name: 'Identify User',
      subscribe: 'type = "identify"',
      partnerAction: 'identifyUser',
      mapping: defaultValues(identifyUser.fields),
      type: 'automatic'
    },
    {
      name: 'Track Page View',
      subscribe: 'type = "page"',
      partnerAction: 'trackPageView',
      mapping: defaultValues(trackPageView.fields),
      type: 'automatic'
    },
    {
      name: 'Track Group Event',
      subscribe: 'type = "group"',
      partnerAction: 'trackGroupEvent',
      mapping: defaultValues(trackGroupEvent.fields),
      type: 'automatic'
    }
  ]
}

export default destination
