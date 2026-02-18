import nock from 'nock'
import { createTestEvent, createTestIntegration } from '@segment/actions-core'
import Definition from '../index'

const testDestination = createTestIntegration(Definition)

const SETTINGS = {
  baseUrl: 'https://gateway.example.com',
  telemetryKey: 'btk_test_key_123',
  serviceName: 'test-service',
  environment: 'production'
}

describe('Brizz', () => {
  describe('testAuthentication', () => {
    it('should validate authentication with valid credentials', async () => {
      nock('https://gateway.example.com')
        .post('/api/v1/telemetry/raw/events')
        .reply(200, { status: 'success', total: 1, success: 1, skipped: 0, failed: 0 })

      await expect(testDestination.testAuthentication(SETTINGS)).resolves.not.toThrowError()
    })

    it('should fail authentication with invalid telemetry key', async () => {
      nock('https://gateway.example.com').post('/api/v1/telemetry/raw/events').reply(401, { error: 'Unauthorized' })

      await expect(testDestination.testAuthentication(SETTINGS)).rejects.toThrowError()
    })
  })

  describe('trackEvent', () => {
    it('should send a track event', async () => {
      nock('https://gateway.example.com')
        .post('/api/v1/telemetry/raw/events', (body) => {
          return body.name === 'Order Completed' && body.source === 'segment' && body.service_name === 'test-service'
        })
        .reply(200, { status: 'success', total: 1, success: 1, skipped: 0, failed: 0 })

      const event = createTestEvent({
        type: 'track',
        event: 'Order Completed',
        userId: 'user-123',
        anonymousId: 'anon-456',
        properties: {
          revenue: 99.99,
          currency: 'USD'
        }
      })

      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(responses.length).toBe(1)
      expect(responses[0].status).toBe(200)
    })

    it('should send a batch of track events', async () => {
      nock('https://gateway.example.com')
        .post('/api/v1/telemetry/raw/events', (body) => {
          return Array.isArray(body) && body.length === 2
        })
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
    it('should send an identify event', async () => {
      nock('https://gateway.example.com')
        .post('/api/v1/telemetry/raw/events', (body) => {
          return body.name === 'identify' && body.attributes['brizz.user_id'] === 'user-789'
        })
        .reply(200, { status: 'success', total: 1, success: 1, skipped: 0, failed: 0 })

      const event = createTestEvent({
        type: 'identify',
        userId: 'user-789',
        traits: {
          email: 'user@example.com',
          name: 'John Doe'
        }
      })

      const responses = await testDestination.testAction('identifyUser', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(responses.length).toBe(1)
      expect(responses[0].status).toBe(200)
    })
  })

  describe('trackPageView', () => {
    it('should send a page event with name', async () => {
      nock('https://gateway.example.com')
        .post('/api/v1/telemetry/raw/events', (body) => {
          return body.name === 'page.Homepage'
        })
        .reply(200, { status: 'success', total: 1, success: 1, skipped: 0, failed: 0 })

      const event = createTestEvent({
        type: 'page',
        name: 'Homepage',
        properties: {
          url: 'https://example.com',
          path: '/'
        }
      })

      const responses = await testDestination.testAction('trackPageView', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(responses.length).toBe(1)
      expect(responses[0].status).toBe(200)
    })

    it('should send a page event without name as page_view', async () => {
      nock('https://gateway.example.com')
        .post('/api/v1/telemetry/raw/events', (body) => {
          return body.name === 'page_view'
        })
        .reply(200, { status: 'success', total: 1, success: 1, skipped: 0, failed: 0 })

      const event = createTestEvent({
        type: 'page',
        properties: {
          url: 'https://example.com',
          path: '/'
        }
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
          context: { '@path': '$.context' },
          enable_batching: true
        }
      })

      expect(responses.length).toBe(1)
      expect(responses[0].status).toBe(200)
    })
  })

  describe('trackGroupEvent', () => {
    it('should send a group event', async () => {
      nock('https://gateway.example.com')
        .post('/api/v1/telemetry/raw/events', (body) => {
          return body.name === 'group' && body.body.group_id === 'group-123'
        })
        .reply(200, { status: 'success', total: 1, success: 1, skipped: 0, failed: 0 })

      const event = createTestEvent({
        type: 'group',
        groupId: 'group-123',
        traits: {
          name: 'Acme Corp',
          plan: 'enterprise'
        }
      })

      const responses = await testDestination.testAction('trackGroupEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(responses.length).toBe(1)
      expect(responses[0].status).toBe(200)
    })
  })

  describe('extendRequest', () => {
    it('should include telemetry key header', async () => {
      nock('https://gateway.example.com')
        .post('/api/v1/telemetry/raw/events')
        .matchHeader('X-Telemetry-Key', 'btk_test_key_123')
        .matchHeader('Content-Type', 'application/json')
        .reply(200, { status: 'success', total: 1, success: 1, skipped: 0, failed: 0 })

      const event = createTestEvent({
        type: 'track',
        event: 'Test Event'
      })

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
