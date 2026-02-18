import nock from 'nock'
import { createTestEvent, createTestIntegration } from '@segment/actions-core'
import Definition from '../index'

const testDestination = createTestIntegration(Definition)

const BASE_URL = 'https://app.example.com/api/v1/telemetry'
const EVENTS_ENDPOINT = '/raw/events'
const SUCCESS_RESPONSE = { status: 'success', total: 1, success: 1, skipped: 0, failed: 0 }

const SETTINGS = {
  baseUrl: BASE_URL,
  apiKey: 'test-key',
  serviceName: 'test-service',
  environment: 'production'
}

describe('Brizz', () => {
  afterEach(() => nock.cleanAll())

  describe('testAuthentication', () => {
    it('should succeed with valid credentials', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200, SUCCESS_RESPONSE)
      await expect(testDestination.testAuthentication(SETTINGS)).resolves.not.toThrowError()
    })

    it('should reject invalid telemetry key', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(401, { error: 'Unauthorized' })
      await expect(testDestination.testAuthentication(SETTINGS)).rejects.toThrowError()
    })
  })

  describe('trackEvent', () => {
    it('should map and send a track event', async () => {
      nock(BASE_URL)
        .post(EVENTS_ENDPOINT, (body) => {
          return (
            body.name === 'Order Completed' &&
            body.source === 'segment' &&
            body.service_name === 'test-service' &&
            body.attributes['segment.event_type'] === 'track' &&
            body.attributes['brizz.user_id'] === 'user-123' &&
            body.attributes['segment.anonymous_id'] === 'anon-456' &&
            body.session_id === 'sess_abc123'
          )
        })
        .reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Order Completed',
        userId: 'user-123',
        anonymousId: 'anon-456',
        properties: { revenue: 99.99, currency: 'USD', sessionId: 'sess_abc123' }
      })

      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(responses.length).toBe(1)
      expect(responses[0].status).toBe(200)
    })

    it('should batch multiple track events as an array', async () => {
      nock(BASE_URL)
        .post(EVENTS_ENDPOINT, (body) => Array.isArray(body) && body.length === 2)
        .reply(200, { status: 'success', total: 2, success: 2, skipped: 0, failed: 0 })

      const events = [
        createTestEvent({ type: 'track', event: 'Event 1', userId: 'user-1' }),
        createTestEvent({ type: 'track', event: 'Event 2', userId: 'user-2' })
      ]

      const responses = await testDestination.testBatchAction('trackEvent', {
        events,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(responses.length).toBe(1)
      expect(responses[0].status).toBe(200)
    })
  })

  describe('identifyUser', () => {
    it('should map and send an identify event', async () => {
      nock(BASE_URL)
        .post(EVENTS_ENDPOINT, (body) => {
          return (
            body.name === 'identify' &&
            body.attributes['brizz.user_id'] === 'user-789' &&
            body.attributes['segment.event_type'] === 'identify' &&
            body.attributes['segment.anonymous_id'] === 'anon-456' &&
            body.session_id === 'sess_abc123' &&
            body.body.email === 'user@example.com'
          )
        })
        .reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'identify',
        userId: 'user-789',
        anonymousId: 'anon-456',
        traits: { email: 'user@example.com', name: 'John Doe', sessionId: 'sess_abc123' }
      })

      const responses = await testDestination.testAction('identifyUser', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(responses.length).toBe(1)
      expect(responses[0].status).toBe(200)
    })

    it('should batch multiple identify events', async () => {
      nock(BASE_URL)
        .post(EVENTS_ENDPOINT, (body) => Array.isArray(body) && body.length === 2 && body[0].name === 'identify')
        .reply(200, { status: 'success', total: 2, success: 2, skipped: 0, failed: 0 })

      const events = [
        createTestEvent({ type: 'identify', userId: 'user-1', traits: { email: 'a@b.com' } }),
        createTestEvent({ type: 'identify', userId: 'user-2', traits: { email: 'c@d.com' } })
      ]

      const responses = await testDestination.testBatchAction('identifyUser', {
        events,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(responses.length).toBe(1)
      expect(responses[0].status).toBe(200)
    })
  })

  describe('trackPageView', () => {
    it('should prefix page name with page.', async () => {
      nock(BASE_URL)
        .post(
          EVENTS_ENDPOINT,
          (body) =>
            body.name === 'page.Homepage' &&
            body.attributes['segment.event_type'] === 'page' &&
            body.attributes['segment.anonymous_id'] === 'anon-456' &&
            body.session_id === 'sess_abc123'
        )
        .reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'page',
        name: 'Homepage',
        anonymousId: 'anon-456',
        properties: { url: 'https://example.com', path: '/', sessionId: 'sess_abc123' }
      })

      const responses = await testDestination.testAction('trackPageView', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(responses.length).toBe(1)
      expect(responses[0].status).toBe(200)
    })

    it('should default to page_view when name is absent', async () => {
      nock(BASE_URL)
        .post(EVENTS_ENDPOINT, (body) => body.name === 'page_view')
        .reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'page',
        properties: { url: 'https://example.com', path: '/' }
      })

      const responses = await testDestination.testAction('trackPageView', {
        event,
        settings: SETTINGS,
        mapping: {
          properties: { '@path': '$.properties' },
          userId: { '@path': '$.userId' },
          anonymousId: { '@path': '$.anonymousId' },
          timestamp: { '@path': '$.timestamp' },
          messageId: { '@path': '$.messageId' },
          context: { '@path': '$.context' }
        }
      })

      expect(responses.length).toBe(1)
      expect(responses[0].status).toBe(200)
    })

    it('should batch multiple page events', async () => {
      nock(BASE_URL)
        .post(EVENTS_ENDPOINT, (body) => Array.isArray(body) && body.length === 2)
        .reply(200, { status: 'success', total: 2, success: 2, skipped: 0, failed: 0 })

      const events = [createTestEvent({ type: 'page', name: 'Home' }), createTestEvent({ type: 'page', name: 'About' })]

      const responses = await testDestination.testBatchAction('trackPageView', {
        events,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(responses.length).toBe(1)
      expect(responses[0].status).toBe(200)
    })
  })

  describe('trackGroupEvent', () => {
    it('should include group_id in body', async () => {
      nock(BASE_URL)
        .post(EVENTS_ENDPOINT, (body) => {
          return (
            body.name === 'group' &&
            body.body.group_id === 'group-123' &&
            body.body.name === 'Acme Corp' &&
            body.attributes['segment.event_type'] === 'group' &&
            body.attributes['segment.anonymous_id'] === 'anon-456' &&
            body.session_id === 'sess_abc123'
          )
        })
        .reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'group',
        groupId: 'group-123',
        anonymousId: 'anon-456',
        traits: { name: 'Acme Corp', plan: 'enterprise', sessionId: 'sess_abc123' }
      })

      const responses = await testDestination.testAction('trackGroupEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(responses.length).toBe(1)
      expect(responses[0].status).toBe(200)
    })

    it('should batch multiple group events', async () => {
      nock(BASE_URL)
        .post(EVENTS_ENDPOINT, (body) => Array.isArray(body) && body.length === 2 && body[0].name === 'group')
        .reply(200, { status: 'success', total: 2, success: 2, skipped: 0, failed: 0 })

      const events = [
        createTestEvent({ type: 'group', groupId: 'g-1', traits: { name: 'A' } }),
        createTestEvent({ type: 'group', groupId: 'g-2', traits: { name: 'B' } })
      ]

      const responses = await testDestination.testBatchAction('trackGroupEvent', {
        events,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(responses.length).toBe(1)
      expect(responses[0].status).toBe(200)
    })
  })

  describe('extendRequest', () => {
    it('should set Authorization and Content-Type headers', async () => {
      nock(BASE_URL)
        .post(EVENTS_ENDPOINT)
        .matchHeader('Authorization', 'Bearer test-key')
        .matchHeader('Content-Type', 'application/json')
        .reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({ type: 'track', event: 'Test' })

      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(responses.length).toBe(1)
      expect(responses[0].status).toBe(200)
    })
  })
})
