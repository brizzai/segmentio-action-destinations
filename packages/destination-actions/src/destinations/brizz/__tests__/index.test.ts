import nock from 'nock'
import { createTestEvent, createTestIntegration } from '@segment/actions-core'
import Definition from '../index'

const testDestination = createTestIntegration(Definition)

const BASE_URL = 'https://app.example.com/api/v1/telemetry'
const EVENTS_ENDPOINT = '/raw/events'

const SETTINGS = {
  baseUrl: BASE_URL,
  apiKey: 'test-key',
  serviceName: 'test-service',
  environment: 'production'
}

const SETTINGS_MINIMAL = {
  baseUrl: BASE_URL,
  apiKey: 'test-key'
}

describe('Brizz', () => {
  afterEach(() => nock.cleanAll())

  describe('testAuthentication', () => {
    it('should succeed with valid credentials', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)
      await expect(testDestination.testAuthentication(SETTINGS)).resolves.not.toThrowError()
    })

    it('should reject invalid API key', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(401, { error: 'Unauthorized' })
      await expect(testDestination.testAuthentication(SETTINGS)).rejects.toThrowError()
    })
  })

  describe('trackEvent', () => {
    it('should send correct payload with all fields', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({
        type: 'track',
        event: 'Order Completed',
        userId: 'user-123',
        anonymousId: 'anon-456',
        timestamp: '2026-01-15T10:30:00.000Z',
        messageId: 'msg-001',
        properties: { revenue: 99.99, currency: 'USD', brizzSessionId: 'sess_abc123' },
        context: {
          page: { url: 'https://example.com', path: '/checkout' },
          userAgent: 'Mozilla/5.0',
          locale: 'en-US'
        }
      })

      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(responses[0].options.json).toMatchObject({
        name: 'Order Completed',
        service_name: 'test-service',
        session_id: 'sess_abc123',
        timestamp: '2026-01-15T10:30:00.000Z',
        source: 'segment',
        environment: 'production',
        severity_number: 9,
        attributes: {
          'brizz.user_id': 'user-123',
          'segment.anonymous_id': 'anon-456',
          'segment.message_id': 'msg-001',
          'segment.event_type': 'track',
          'page.url': 'https://example.com',
          'page.path': '/checkout',
          userAgent: 'Mozilla/5.0',
          locale: 'en-US'
        },
        body: { revenue: 99.99, currency: 'USD' }
      })
    })

    it('should set Authorization and Content-Type headers', async () => {
      nock(BASE_URL)
        .post(EVENTS_ENDPOINT)
        .matchHeader('Authorization', 'Bearer test-key')
        .matchHeader('Content-Type', 'application/json')
        .reply(200)

      const event = createTestEvent({ type: 'track', event: 'Test' })
      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })
      expect(responses[0].status).toBe(200)
    })

    it('should batch multiple events as an array', async () => {
      nock(BASE_URL)
        .post(EVENTS_ENDPOINT, (body: unknown[]) => Array.isArray(body) && body.length === 2)
        .reply(200)

      const events = [
        createTestEvent({ type: 'track', event: 'Event 1', userId: 'user-1' }),
        createTestEvent({ type: 'track', event: 'Event 2', userId: 'user-2' })
      ]

      const responses = await testDestination.testBatchAction('trackEvent', {
        events,
        settings: SETTINGS,
        useDefaultMappings: true
      })
      expect(responses[0].status).toBe(200)
    })

    it('should strip brizz-prefixed keys from body', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: {
          revenue: 50,
          brizzSessionId: 'sess_123',
          brizzServiceName: 'my-app',
          brizzEnvironment: 'staging',
          brizzSeverityNumber: 13
        }
      })

      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      const body = (responses[0].options.json as Record<string, unknown>).body as Record<string, unknown>
      expect(body).toEqual({ revenue: 50 })
    })

    it('should handle missing optional fields', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({ type: 'track', event: 'Minimal', properties: {} })

      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        mapping: {
          name: { '@path': '$.event' },
          properties: { '@path': '$.properties' },
          timestamp: { '@path': '$.timestamp' },
          context: { '@path': '$.context' }
        }
      })

      const json = responses[0].options.json as Record<string, unknown>
      const attrs = json.attributes as Record<string, unknown>
      expect(attrs['brizz.user_id']).toBeUndefined()
      expect(attrs['segment.anonymous_id']).toBeUndefined()
      expect(attrs['segment.message_id']).toBeUndefined()
      expect(json.session_id).toBe('')
    })
  })

  describe('identifyUser', () => {
    it('should send identify event with traits as body', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({
        type: 'identify',
        userId: 'user-789',
        anonymousId: 'anon-456',
        timestamp: '2026-01-15T10:30:00.000Z',
        traits: { email: 'user@example.com', name: 'John Doe', brizzSessionId: 'sess_abc123' }
      })

      const responses = await testDestination.testAction('identifyUser', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(responses[0].options.json).toMatchObject({
        name: 'identify',
        session_id: 'sess_abc123',
        attributes: {
          'brizz.user_id': 'user-789',
          'segment.anonymous_id': 'anon-456',
          'segment.event_type': 'identify'
        },
        body: { email: 'user@example.com', name: 'John Doe' }
      })
    })

    it('should batch multiple identify events', async () => {
      nock(BASE_URL)
        .post(
          EVENTS_ENDPOINT,
          (body: unknown[]) =>
            Array.isArray(body) && body.length === 2 && (body[0] as Record<string, unknown>).name === 'identify'
        )
        .reply(200)

      const events = [
        createTestEvent({ type: 'identify', userId: 'user-1', traits: { email: 'a@b.com' } }),
        createTestEvent({ type: 'identify', userId: 'user-2', traits: { email: 'c@d.com' } })
      ]

      const responses = await testDestination.testBatchAction('identifyUser', {
        events,
        settings: SETTINGS,
        useDefaultMappings: true
      })
      expect(responses[0].status).toBe(200)
    })
  })

  describe('trackPageView', () => {
    it('should prefix page name with page.', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({
        type: 'page',
        name: 'Homepage',
        anonymousId: 'anon-456',
        properties: { url: 'https://example.com', path: '/', brizzSessionId: 'sess_abc123' }
      })

      const responses = await testDestination.testAction('trackPageView', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(responses[0].options.json).toMatchObject({
        name: 'page.Homepage',
        session_id: 'sess_abc123',
        attributes: { 'segment.event_type': 'page' }
      })
    })

    it('should default to page_view when name is absent', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({ type: 'page', properties: { url: 'https://example.com' } })

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

      expect((responses[0].options.json as Record<string, unknown>).name).toBe('page_view')
    })

    it('should include category in body', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({
        type: 'page',
        name: 'Pricing',
        properties: { url: 'https://example.com/pricing' }
      })
      ;(event as Record<string, unknown>).category = 'Marketing'

      const responses = await testDestination.testAction('trackPageView', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      const body = (responses[0].options.json as Record<string, unknown>).body as Record<string, unknown>
      expect(body.category).toBe('Marketing')
      expect(body.url).toBe('https://example.com/pricing')
    })

    it('should batch multiple page events', async () => {
      nock(BASE_URL)
        .post(EVENTS_ENDPOINT, (body: unknown[]) => Array.isArray(body) && body.length === 2)
        .reply(200)

      const events = [createTestEvent({ type: 'page', name: 'Home' }), createTestEvent({ type: 'page', name: 'About' })]

      const responses = await testDestination.testBatchAction('trackPageView', {
        events,
        settings: SETTINGS,
        useDefaultMappings: true
      })
      expect(responses[0].status).toBe(200)
    })
  })

  describe('trackGroupEvent', () => {
    it('should include group_id in body and strip brizz fields', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({
        type: 'group',
        groupId: 'group-123',
        anonymousId: 'anon-456',
        traits: { name: 'Acme Corp', plan: 'enterprise', brizzSessionId: 'sess_abc123' }
      })

      const responses = await testDestination.testAction('trackGroupEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(responses[0].options.json).toMatchObject({
        name: 'group',
        session_id: 'sess_abc123',
        attributes: { 'segment.event_type': 'group' },
        body: { group_id: 'group-123', name: 'Acme Corp', plan: 'enterprise' }
      })
      expect(
        ((responses[0].options.json as Record<string, unknown>).body as Record<string, unknown>).brizzSessionId
      ).toBeUndefined()
    })

    it('should batch multiple group events', async () => {
      nock(BASE_URL)
        .post(
          EVENTS_ENDPOINT,
          (body: unknown[]) =>
            Array.isArray(body) && body.length === 2 && (body[0] as Record<string, unknown>).name === 'group'
        )
        .reply(200)

      const events = [
        createTestEvent({ type: 'group', groupId: 'g-1', traits: { name: 'A' } }),
        createTestEvent({ type: 'group', groupId: 'g-2', traits: { name: 'B' } })
      ]

      const responses = await testDestination.testBatchAction('trackGroupEvent', {
        events,
        settings: SETTINGS,
        useDefaultMappings: true
      })
      expect(responses[0].status).toBe(200)
    })
  })

  describe('session_id aliases', () => {
    it.each([
      ['brizzSessionId', 'camelCase'],
      ['brizz.session.id', 'dot-notation'],
      ['brizz.session_id', 'underscore']
    ])('should resolve %s', async (key, value) => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({ type: 'track', event: 'Test', properties: { [key]: value } })
      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect((responses[0].options.json as Record<string, unknown>).session_id).toBe(value)
    })

    it('should prefer first alias (brizzSessionId)', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { brizzSessionId: 'first', 'brizz.session.id': 'second', 'brizz.session_id': 'third' }
      })

      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })
      expect((responses[0].options.json as Record<string, unknown>).session_id).toBe('first')
    })

    it('should default to empty string when absent', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({ type: 'track', event: 'Test', properties: { revenue: 10 } })
      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })
      expect((responses[0].options.json as Record<string, unknown>).session_id).toBe('')
    })

    it('should resolve from traits on identify', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({
        type: 'identify',
        userId: 'u-1',
        traits: { email: 'a@b.com', 'brizz.session_id': 'from-traits' }
      })

      const responses = await testDestination.testAction('identifyUser', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })
      expect((responses[0].options.json as Record<string, unknown>).session_id).toBe('from-traits')
    })
  })

  describe('dynamic serviceName and environment', () => {
    it('should use properties when settings are empty', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { brizzServiceName: 'dynamic-svc', brizzEnvironment: 'staging' }
      })

      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS_MINIMAL,
        useDefaultMappings: true
      })

      const json = responses[0].options.json as Record<string, unknown>
      expect(json.service_name).toBe('dynamic-svc')
      expect(json.environment).toBe('staging')
    })

    it('should fall back to unknown / undefined when nothing set', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({ type: 'track', event: 'Test', properties: { revenue: 10 } })
      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS_MINIMAL,
        useDefaultMappings: true
      })

      const json = responses[0].options.json as Record<string, unknown>
      expect(json.service_name).toBe('unknown')
      expect(json.environment).toBeUndefined()
    })

    it('should prioritize settings over properties', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { brizzServiceName: 'from-props', brizzEnvironment: 'from-props' }
      })

      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      const json = responses[0].options.json as Record<string, unknown>
      expect(json.service_name).toBe('test-service')
      expect(json.environment).toBe('production')
    })

    it.each([
      ['brizz.service.name', 'brizz.environment'],
      ['brizz.service_name', 'brizz.environment']
    ])('should resolve %s and %s aliases', async (svcKey, envKey) => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { [svcKey]: 'alias-svc', [envKey]: 'alias-env' }
      })

      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS_MINIMAL,
        useDefaultMappings: true
      })

      const json = responses[0].options.json as Record<string, unknown>
      expect(json.service_name).toBe('alias-svc')
      expect(json.environment).toBe('alias-env')
    })
  })

  describe('severity_number', () => {
    it('should default to 9 when not provided', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({ type: 'track', event: 'Test', properties: { revenue: 10 } })
      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })
      expect((responses[0].options.json as Record<string, unknown>).severity_number).toBe(9)
    })

    it.each([
      ['brizzSeverityNumber', 17],
      ['brizz.severity.number', 5],
      ['brizz.severity_number', 21]
    ])('should resolve numeric alias %s', async (key, value) => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({ type: 'track', event: 'Test', properties: { [key]: value } })
      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })
      expect((responses[0].options.json as Record<string, unknown>).severity_number).toBe(value)
    })

    it.each([
      ['error', 17],
      ['warn', 13],
      ['debug', 5],
      ['fatal', 21],
      ['trace', 1],
      ['info', 9],
      ['critical', 21],
      ['warning', 13]
    ])('should map string level "%s" to %i', async (level, expected) => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({ type: 'track', event: 'Test', properties: { brizzSeverity: level } })
      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })
      expect((responses[0].options.json as Record<string, unknown>).severity_number).toBe(expected)
    })

    it('should be case-insensitive for string levels', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({ type: 'track', event: 'Test', properties: { brizzSeverity: 'ERROR' } })
      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })
      expect((responses[0].options.json as Record<string, unknown>).severity_number).toBe(17)
    })

    it('should prefer numeric over string level', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { brizzSeverityNumber: 1, brizzSeverity: 'fatal' }
      })

      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })
      expect((responses[0].options.json as Record<string, unknown>).severity_number).toBe(1)
    })

    it('should accept 0 (UNSPECIFIED) as valid', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({ type: 'track', event: 'Test', properties: { brizzSeverityNumber: 0 } })
      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })
      expect((responses[0].options.json as Record<string, unknown>).severity_number).toBe(0)
    })

    it('should ignore out-of-range values and default to 9', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({ type: 'track', event: 'Test', properties: { brizzSeverityNumber: 99 } })
      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })
      expect((responses[0].options.json as Record<string, unknown>).severity_number).toBe(9)
    })

    it('should resolve brizz.severity alias for string level', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({ type: 'track', event: 'Test', properties: { 'brizz.severity': 'warn' } })
      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })
      expect((responses[0].options.json as Record<string, unknown>).severity_number).toBe(13)
    })
  })

  describe('context flattening', () => {
    it('should flatten nested context into dot-notation attributes', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        context: {
          page: { url: 'https://example.com', path: '/checkout', referrer: 'https://google.com' },
          userAgent: 'Mozilla/5.0',
          locale: 'en-US',
          device: { type: 'mobile', manufacturer: 'Apple' }
        }
      })

      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect((responses[0].options.json as Record<string, unknown>).attributes).toMatchObject({
        'page.url': 'https://example.com',
        'page.path': '/checkout',
        'page.referrer': 'https://google.com',
        userAgent: 'Mozilla/5.0',
        locale: 'en-US',
        'device.type': 'mobile',
        'device.manufacturer': 'Apple'
      })
    })

    it('should preserve arrays without flattening', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({ type: 'track', event: 'Test', context: { tags: ['vip', 'beta'] } })
      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      const attrs = (responses[0].options.json as Record<string, unknown>).attributes as Record<string, unknown>
      expect(attrs['tags']).toEqual(['vip', 'beta'])
    })
  })

  describe('event type derivation', () => {
    it.each([
      ['trackEvent', 'track', { type: 'track' as const, event: 'Click' }],
      ['identifyUser', 'identify', { type: 'identify' as const, userId: 'u-1', traits: {} }],
      ['trackPageView', 'page', { type: 'page' as const, name: 'Home' }],
      ['trackGroupEvent', 'group', { type: 'group' as const, groupId: 'g-1', traits: {} }]
    ])('%s should set segment.event_type to "%s"', async (action, expectedType, eventData) => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent(eventData)
      const responses = await testDestination.testAction(action, {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      const attrs = (responses[0].options.json as Record<string, unknown>).attributes as Record<string, unknown>
      expect(attrs['segment.event_type']).toBe(expectedType)
    })
  })

  describe('default base URL', () => {
    it('should use https://telemetry.brizz.dev when baseUrl is not set', async () => {
      nock('https://telemetry.brizz.dev').post(EVENTS_ENDPOINT).reply(200)

      const event = createTestEvent({ type: 'track', event: 'Test' })
      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: { apiKey: 'test-key' },
        useDefaultMappings: true
      })
      expect(responses[0].status).toBe(200)
    })
  })
})
