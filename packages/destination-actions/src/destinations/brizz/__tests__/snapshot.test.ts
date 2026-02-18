import { createTestEvent, createTestIntegration } from '@segment/actions-core'
import { generateTestData } from '../../../lib/test-data'
import destination from '../index'
import nock from 'nock'

const fixedDate = new Date('2024-01-01T00:00:00.000Z')
jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as unknown as Date)

const testDestination = createTestIntegration(destination)
const destinationSlug = 'actions-brizz'

const BASE_URL = 'https://app.example.com/api/v1/telemetry'
const SETTINGS = { baseUrl: BASE_URL, apiKey: 'test-key', serviceName: 'test-service', environment: 'production' }
const SETTINGS_MINIMAL = { baseUrl: BASE_URL, apiKey: 'test-key' }

describe(`Testing snapshot for ${destinationSlug} destination:`, () => {
  for (const actionSlug in destination.actions) {
    it(`${actionSlug} action - required fields`, async () => {
      const seedName = `${destinationSlug}#${actionSlug}`
      const action = destination.actions[actionSlug]
      const [eventData, settingsData] = generateTestData(seedName, destination, action, true)

      nock(/.*/).persist().get(/.*/).reply(200)
      nock(/.*/).persist().post(/.*/).reply(200)
      nock(/.*/).persist().put(/.*/).reply(200)

      const event = createTestEvent({
        properties: eventData
      })

      const responses = await testDestination.testAction(actionSlug, {
        event: event,
        mapping: event.properties,
        settings: settingsData,
        auth: undefined
      })

      const request = responses[0].request
      const rawBody = await request.text()

      try {
        const json = JSON.parse(rawBody)
        expect(json).toMatchSnapshot()
        return
      } catch (err) {
        expect(rawBody).toMatchSnapshot()
      }

      expect(request.headers).toMatchSnapshot()
    })

    it(`${actionSlug} action - all fields`, async () => {
      const seedName = `${destinationSlug}#${actionSlug}`
      const action = destination.actions[actionSlug]
      const [eventData, settingsData] = generateTestData(seedName, destination, action, false)

      nock(/.*/).persist().get(/.*/).reply(200)
      nock(/.*/).persist().post(/.*/).reply(200)
      nock(/.*/).persist().put(/.*/).reply(200)

      const event = createTestEvent({
        properties: eventData
      })

      const responses = await testDestination.testAction(actionSlug, {
        event: event,
        mapping: event.properties,
        settings: settingsData,
        auth: undefined
      })

      const request = responses[0].request
      const rawBody = await request.text()

      try {
        const json = JSON.parse(rawBody)
        expect(json).toMatchSnapshot()
        return
      } catch (err) {
        expect(rawBody).toMatchSnapshot()
      }
    })
  }
})

describe('Brizz payload snapshots with brizz attributes:', () => {
  afterEach(() => nock.cleanAll())

  it('trackEvent with brizz fields', async () => {
    nock(BASE_URL).post('/raw/events').reply(200)

    const event = createTestEvent({
      type: 'track',
      event: 'Order Completed',
      userId: 'user-123',
      anonymousId: 'anon-456',
      timestamp: '2026-01-15T10:30:00.000Z',
      messageId: 'msg-001',
      properties: {
        revenue: 99.99,
        currency: 'USD',
        brizzSessionId: 'sess_abc123',
        brizzSeverityNumber: 13
      },
      context: {
        page: { url: 'https://example.com/checkout', path: '/checkout' },
        userAgent: 'Mozilla/5.0',
        locale: 'en-US'
      }
    })

    const responses = await testDestination.testAction('trackEvent', {
      event,
      settings: SETTINGS,
      useDefaultMappings: true
    })
    expect(responses[0].options.json).toMatchSnapshot()
  })

  it('trackEvent with dynamic serviceName and environment from properties', async () => {
    nock(BASE_URL).post('/raw/events').reply(200)

    const event = createTestEvent({
      type: 'track',
      event: 'Payment Processed',
      userId: 'user-456',
      timestamp: '2026-01-15T11:00:00.000Z',
      messageId: 'msg-003',
      properties: {
        amount: 150,
        brizzSessionId: 'sess_dynamic',
        brizzServiceName: 'checkout-svc',
        brizzEnvironment: 'staging',
        brizzSeverity: 'error'
      }
    })

    const responses = await testDestination.testAction('trackEvent', {
      event,
      settings: SETTINGS_MINIMAL,
      useDefaultMappings: true
    })
    expect(responses[0].options.json).toMatchSnapshot()
  })

  it('identifyUser with brizz fields in traits', async () => {
    nock(BASE_URL).post('/raw/events').reply(200)

    const event = createTestEvent({
      type: 'identify',
      userId: 'user-789',
      anonymousId: 'anon-012',
      timestamp: '2026-01-15T12:00:00.000Z',
      messageId: 'msg-002',
      traits: {
        email: 'jane@example.com',
        name: 'Jane Doe',
        plan: 'enterprise',
        brizzSessionId: 'sess_identify',
        brizzSeverity: 'info'
      }
    })

    const responses = await testDestination.testAction('identifyUser', {
      event,
      settings: SETTINGS,
      useDefaultMappings: true
    })
    expect(responses[0].options.json).toMatchSnapshot()
  })

  it('trackPageView with brizz fields', async () => {
    nock(BASE_URL).post('/raw/events').reply(200)

    const event = createTestEvent({
      type: 'page',
      name: 'Pricing',
      userId: 'user-321',
      timestamp: '2026-01-15T13:00:00.000Z',
      messageId: 'msg-004',
      properties: {
        url: 'https://example.com/pricing',
        path: '/pricing',
        title: 'Pricing Page',
        brizzSessionId: 'sess_page'
      }
    })
    ;(event as Record<string, unknown>).category = 'Marketing'

    const responses = await testDestination.testAction('trackPageView', {
      event,
      settings: SETTINGS,
      useDefaultMappings: true
    })
    expect(responses[0].options.json).toMatchSnapshot()
  })

  it('trackGroupEvent with brizz fields in traits', async () => {
    nock(BASE_URL).post('/raw/events').reply(200)

    const event = createTestEvent({
      type: 'group',
      groupId: 'org-555',
      userId: 'user-654',
      timestamp: '2026-01-15T14:00:00.000Z',
      messageId: 'msg-005',
      traits: {
        name: 'Acme Corp',
        plan: 'enterprise',
        employees: 120,
        brizzSessionId: 'sess_group',
        brizzSeverityNumber: 5
      }
    })

    const responses = await testDestination.testAction('trackGroupEvent', {
      event,
      settings: SETTINGS,
      useDefaultMappings: true
    })
    expect(responses[0].options.json).toMatchSnapshot()
  })

  it('trackEvent batch with brizz fields', async () => {
    nock(BASE_URL).post('/raw/events').reply(200)

    const events = [
      createTestEvent({
        type: 'track',
        event: 'Item Added',
        userId: 'user-a',
        timestamp: '2026-01-15T15:00:00.000Z',
        messageId: 'msg-006',
        properties: { item: 'widget', brizzSessionId: 'sess_batch', brizzSeverity: 'debug' }
      }),
      createTestEvent({
        type: 'track',
        event: 'Item Removed',
        userId: 'user-b',
        timestamp: '2026-01-15T15:01:00.000Z',
        messageId: 'msg-007',
        properties: { item: 'gadget', brizzSessionId: 'sess_batch', brizzSeverityNumber: 17 }
      })
    ]

    const responses = await testDestination.testBatchAction('trackEvent', {
      events,
      settings: SETTINGS,
      useDefaultMappings: true
    })
    expect(responses[0].options.json).toMatchSnapshot()
  })
})
