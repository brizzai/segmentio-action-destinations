import nock from 'nock'
import { createTestEvent, createTestIntegration } from '@segment/actions-core'
import Definition from '../index'

const testDestination = createTestIntegration(Definition)

const BASE_URL = 'https://app.example.com/api/v1/telemetry'
const EVENTS_ENDPOINT = '/raw/events'
const SUCCESS_RESPONSE = { status: 'success', total: 1, success: 1, skipped: 0, failed: 0 }
const BATCH_SUCCESS = { status: 'success', total: 2, success: 2, skipped: 0, failed: 0 }

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

/** Capture the JSON body sent to nock */
function captureBody() {
  let captured: Record<string, unknown> = {}
  return {
    intercept: (b: Record<string, unknown>) => {
      captured = b
      return true
    },
    body: () => captured
  }
}

describe('Brizz', () => {
  afterEach(() => nock.cleanAll())

  // ── Authentication ────────────────────────────────────────────────────────

  describe('testAuthentication', () => {
    it('should succeed with valid credentials', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(200, SUCCESS_RESPONSE)
      await expect(testDestination.testAuthentication(SETTINGS)).resolves.not.toThrowError()
    })

    it('should reject invalid API key (401)', async () => {
      nock(BASE_URL).post(EVENTS_ENDPOINT).reply(401, { error: 'Unauthorized' })
      await expect(testDestination.testAuthentication(SETTINGS)).rejects.toThrowError()
    })
  })

  // ── Headers ───────────────────────────────────────────────────────────────

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

  // ── trackEvent ────────────────────────────────────────────────────────────

  describe('trackEvent', () => {
    it('should produce correct full payload shape', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

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
          brizzSessionId: 'sess_abc123'
        },
        context: {
          page: { url: 'https://example.com', path: '/checkout' },
          userAgent: 'Mozilla/5.0',
          locale: 'en-US'
        }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      const b = cap.body()
      expect(b.name).toBe('Order Completed')
      expect(b.service_name).toBe('test-service')
      expect(b.session_id).toBe('sess_abc123')
      expect(b.timestamp).toBe('2026-01-15T10:30:00.000Z')
      expect(b.source).toBe('segment')
      expect(b.environment).toBe('production')
      expect(b.severity_number).toBe(9)
      expect((b.attributes as Record<string, unknown>)['brizz.user_id']).toBe('user-123')
      expect((b.attributes as Record<string, unknown>)['segment.anonymous_id']).toBe('anon-456')
      expect((b.attributes as Record<string, unknown>)['segment.message_id']).toBe('msg-001')
      expect((b.attributes as Record<string, unknown>)['segment.event_type']).toBe('track')
      expect((b.attributes as Record<string, unknown>)['page.url']).toBe('https://example.com')
      expect((b.attributes as Record<string, unknown>)['page.path']).toBe('/checkout')
      expect((b.attributes as Record<string, unknown>)['user_agent']).toBe(undefined)
      expect((b.attributes as Record<string, unknown>)['userAgent']).toBe('Mozilla/5.0')
      expect((b.attributes as Record<string, unknown>)['locale']).toBe('en-US')
      expect((b.body as Record<string, unknown>).revenue).toBe(99.99)
      expect((b.body as Record<string, unknown>).currency).toBe('USD')
    })

    it('should batch multiple track events as an array', async () => {
      let captured: unknown[] = []
      nock(BASE_URL)
        .post(EVENTS_ENDPOINT, (body: unknown[]) => {
          captured = body
          return Array.isArray(body)
        })
        .reply(200, BATCH_SUCCESS)

      const events = [
        createTestEvent({ type: 'track', event: 'Event 1', userId: 'user-1' }),
        createTestEvent({ type: 'track', event: 'Event 2', userId: 'user-2' })
      ]

      await testDestination.testBatchAction('trackEvent', {
        events,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(captured.length).toBe(2)
      expect((captured[0] as Record<string, unknown>).name).toBe('Event 1')
      expect((captured[1] as Record<string, unknown>).name).toBe('Event 2')
    })

    it('should strip brizz-prefixed keys from body', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

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

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      const body = cap.body().body as Record<string, unknown>
      expect(body.revenue).toBe(50)
      expect(body.brizzSessionId).toBeUndefined()
      expect(body.brizzServiceName).toBeUndefined()
      expect(body.brizzEnvironment).toBeUndefined()
      expect(body.brizzSeverityNumber).toBeUndefined()
    })

    it('should handle missing optional fields gracefully', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Minimal Event',
        properties: {}
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        mapping: {
          name: { '@path': '$.event' },
          properties: { '@path': '$.properties' },
          timestamp: { '@path': '$.timestamp' },
          context: { '@path': '$.context' }
          // userId, anonymousId, messageId intentionally omitted
        }
      })

      const b = cap.body()
      const attrs = b.attributes as Record<string, unknown>
      expect(attrs['brizz.user_id']).toBeUndefined()
      expect(attrs['segment.anonymous_id']).toBeUndefined()
      expect(attrs['segment.message_id']).toBeUndefined()
      expect(attrs['segment.event_type']).toBe('track')
      expect(b.session_id).toBe('')
      expect(b.service_name).toBe('test-service')
    })
  })

  // ── identifyUser ──────────────────────────────────────────────────────────

  describe('identifyUser', () => {
    it('should produce correct payload for identify', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'identify',
        userId: 'user-789',
        anonymousId: 'anon-456',
        timestamp: '2026-01-15T10:30:00.000Z',
        traits: { email: 'user@example.com', name: 'John Doe', brizzSessionId: 'sess_abc123' }
      })

      await testDestination.testAction('identifyUser', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      const b = cap.body()
      expect(b.name).toBe('identify')
      expect(b.session_id).toBe('sess_abc123')
      expect((b.attributes as Record<string, unknown>)['brizz.user_id']).toBe('user-789')
      expect((b.attributes as Record<string, unknown>)['segment.anonymous_id']).toBe('anon-456')
      expect((b.attributes as Record<string, unknown>)['segment.event_type']).toBe('identify')
      expect((b.body as Record<string, unknown>).email).toBe('user@example.com')
      expect((b.body as Record<string, unknown>).brizzSessionId).toBeUndefined()
    })

    it('should batch multiple identify events', async () => {
      nock(BASE_URL)
        .post(
          EVENTS_ENDPOINT,
          (body: unknown[]) =>
            Array.isArray(body) && body.length === 2 && (body[0] as Record<string, unknown>).name === 'identify'
        )
        .reply(200, BATCH_SUCCESS)

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

  // ── trackPageView ─────────────────────────────────────────────────────────

  describe('trackPageView', () => {
    it('should prefix page name with page.', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'page',
        name: 'Homepage',
        anonymousId: 'anon-456',
        properties: { url: 'https://example.com', path: '/', brizzSessionId: 'sess_abc123' }
      })

      await testDestination.testAction('trackPageView', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      const b = cap.body()
      expect(b.name).toBe('page.Homepage')
      expect(b.session_id).toBe('sess_abc123')
      expect((b.attributes as Record<string, unknown>)['segment.event_type']).toBe('page')
    })

    it('should default to page_view when name is absent', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'page',
        properties: { url: 'https://example.com', path: '/' }
      })

      await testDestination.testAction('trackPageView', {
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

      expect(cap.body().name).toBe('page_view')
    })

    it('should include category in body', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'page',
        name: 'Pricing',
        properties: { url: 'https://example.com/pricing' }
      })
      ;(event as Record<string, unknown>).category = 'Marketing'

      await testDestination.testAction('trackPageView', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      const body = cap.body().body as Record<string, unknown>
      expect(body.category).toBe('Marketing')
      expect(body.url).toBe('https://example.com/pricing')
    })

    it('should batch multiple page events', async () => {
      nock(BASE_URL)
        .post(EVENTS_ENDPOINT, (body: unknown[]) => Array.isArray(body) && body.length === 2)
        .reply(200, BATCH_SUCCESS)

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

  // ── trackGroupEvent ───────────────────────────────────────────────────────

  describe('trackGroupEvent', () => {
    it('should include group_id in body and strip brizz fields', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'group',
        groupId: 'group-123',
        anonymousId: 'anon-456',
        traits: { name: 'Acme Corp', plan: 'enterprise', brizzSessionId: 'sess_abc123' }
      })

      await testDestination.testAction('trackGroupEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      const b = cap.body()
      expect(b.name).toBe('group')
      expect(b.session_id).toBe('sess_abc123')
      expect((b.attributes as Record<string, unknown>)['segment.event_type']).toBe('group')
      expect((b.body as Record<string, unknown>).group_id).toBe('group-123')
      expect((b.body as Record<string, unknown>).name).toBe('Acme Corp')
      expect((b.body as Record<string, unknown>).plan).toBe('enterprise')
      expect((b.body as Record<string, unknown>).brizzSessionId).toBeUndefined()
    })

    it('should batch multiple group events', async () => {
      nock(BASE_URL)
        .post(
          EVENTS_ENDPOINT,
          (body: unknown[]) =>
            Array.isArray(body) && body.length === 2 && (body[0] as Record<string, unknown>).name === 'group'
        )
        .reply(200, BATCH_SUCCESS)

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

  // ── Session ID alias variants ─────────────────────────────────────────────

  describe('session_id alias lookup', () => {
    it('should resolve brizzSessionId', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { brizzSessionId: 'via-camelCase' }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(cap.body().session_id).toBe('via-camelCase')
    })

    it('should resolve brizz.session.id', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { 'brizz.session.id': 'via-dot-notation' }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(cap.body().session_id).toBe('via-dot-notation')
    })

    it('should resolve brizz.session_id', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { 'brizz.session_id': 'via-underscore' }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(cap.body().session_id).toBe('via-underscore')
    })

    it('should prefer first alias (brizzSessionId) over later ones', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: {
          brizzSessionId: 'first-wins',
          'brizz.session.id': 'second',
          'brizz.session_id': 'third'
        }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(cap.body().session_id).toBe('first-wins')
    })

    it('should default to empty string when no session alias present', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { revenue: 10 }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(cap.body().session_id).toBe('')
    })

    it('should resolve session_id from traits on identify', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'identify',
        userId: 'user-1',
        traits: { email: 'a@b.com', 'brizz.session_id': 'from-traits' }
      })

      await testDestination.testAction('identifyUser', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(cap.body().session_id).toBe('from-traits')
    })
  })

  // ── Dynamic serviceName / environment from properties ─────────────────────

  describe('dynamic serviceName and environment', () => {
    it('should use brizzServiceName from properties when settings.serviceName is empty', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { brizzServiceName: 'dynamic-service', brizzEnvironment: 'staging' }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS_MINIMAL,
        useDefaultMappings: true
      })

      expect(cap.body().service_name).toBe('dynamic-service')
      expect(cap.body().environment).toBe('staging')
    })

    it('should fall back to "unknown" when no serviceName anywhere', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { revenue: 10 }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS_MINIMAL,
        useDefaultMappings: true
      })

      expect(cap.body().service_name).toBe('unknown')
      expect(cap.body().environment).toBeUndefined()
    })

    it('should prioritize settings over properties for serviceName and environment', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: {
          brizzServiceName: 'from-props',
          brizzEnvironment: 'from-props'
        }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS, // has serviceName: 'test-service', environment: 'production'
        useDefaultMappings: true
      })

      expect(cap.body().service_name).toBe('test-service')
      expect(cap.body().environment).toBe('production')
    })

    it('should resolve brizz.service.name and brizz.environment aliases', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { 'brizz.service.name': 'dot-service', 'brizz.environment': 'dot-env' }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS_MINIMAL,
        useDefaultMappings: true
      })

      expect(cap.body().service_name).toBe('dot-service')
      expect(cap.body().environment).toBe('dot-env')
    })
  })

  // ── Severity number ───────────────────────────────────────────────────────

  describe('severity_number', () => {
    it('should default to 9 (INFO) when no severity provided', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { revenue: 10 }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(cap.body().severity_number).toBe(9)
    })

    it('should resolve brizzSeverityNumber (numeric)', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Error Occurred',
        properties: { brizzSeverityNumber: 17 }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(cap.body().severity_number).toBe(17)
    })

    it('should resolve brizz.severity.number alias', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { 'brizz.severity.number': 5 }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(cap.body().severity_number).toBe(5)
    })

    it('should resolve brizz.severity_number alias', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { 'brizz.severity_number': 21 }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(cap.body().severity_number).toBe(21)
    })

    it('should resolve brizzSeverity string level "error" to 17', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Error Occurred',
        properties: { brizzSeverity: 'error' }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(cap.body().severity_number).toBe(17)
    })

    it('should resolve brizz.severity string level "warn" to 13', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { 'brizz.severity': 'warn' }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(cap.body().severity_number).toBe(13)
    })

    it('should resolve brizzSeverity "debug" to 5 (case-insensitive)', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { brizzSeverity: 'DEBUG' }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(cap.body().severity_number).toBe(5)
    })

    it('should prefer numeric severity over string level', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: {
          brizzSeverityNumber: 1,
          brizzSeverity: 'fatal'
        }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(cap.body().severity_number).toBe(1)
    })

    it('should ignore out-of-range numeric severity and fall back to default', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { brizzSeverityNumber: 99 }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(cap.body().severity_number).toBe(9)
    })

    it('should handle severity 0 (UNSPECIFIED) as valid', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { brizzSeverityNumber: 0 }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      expect(cap.body().severity_number).toBe(0)
    })

    it('should strip severity brizz fields from body', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        properties: { brizzSeverityNumber: 17, brizzSeverity: 'error', data: 'keep-me' }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      const body = cap.body().body as Record<string, unknown>
      expect(body.data).toBe('keep-me')
      expect(body.brizzSeverityNumber).toBeUndefined()
      expect(body.brizzSeverity).toBeUndefined()
    })
  })

  // ── Context flattening ────────────────────────────────────────────────────

  describe('context flattening', () => {
    it('should flatten nested context objects into dot-notation attributes', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        context: {
          page: {
            url: 'https://example.com/checkout',
            path: '/checkout',
            referrer: 'https://google.com',
            title: 'Checkout'
          },
          userAgent: 'Mozilla/5.0',
          locale: 'en-US',
          ip: '1.2.3.4',
          device: {
            type: 'mobile',
            manufacturer: 'Apple'
          }
        }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      const attrs = cap.body().attributes as Record<string, unknown>
      expect(attrs['page.url']).toBe('https://example.com/checkout')
      expect(attrs['page.path']).toBe('/checkout')
      expect(attrs['page.referrer']).toBe('https://google.com')
      expect(attrs['page.title']).toBe('Checkout')
      expect(attrs['userAgent']).toBe('Mozilla/5.0')
      expect(attrs['locale']).toBe('en-US')
      expect(attrs['ip']).toBe('1.2.3.4')
      expect(attrs['device.type']).toBe('mobile')
      expect(attrs['device.manufacturer']).toBe('Apple')
    })

    it('should handle empty context', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        context: {}
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      const attrs = cap.body().attributes as Record<string, unknown>
      // Should still have the standard segment attributes
      expect(attrs['segment.event_type']).toBe('track')
    })

    it('should preserve arrays in context without flattening them', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({
        type: 'track',
        event: 'Test',
        context: {
          tags: ['vip', 'beta']
        }
      })

      await testDestination.testAction('trackEvent', {
        event,
        settings: SETTINGS,
        useDefaultMappings: true
      })

      const attrs = cap.body().attributes as Record<string, unknown>
      expect(attrs['tags']).toEqual(['vip', 'beta'])
    })
  })

  // ── Event type derivation ─────────────────────────────────────────────────

  describe('event type derivation', () => {
    it('should set segment.event_type to "track" for track events', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({ type: 'track', event: 'Click' })
      await testDestination.testAction('trackEvent', { event, settings: SETTINGS, useDefaultMappings: true })

      expect((cap.body().attributes as Record<string, unknown>)['segment.event_type']).toBe('track')
    })

    it('should set segment.event_type to "identify" for identify events', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({ type: 'identify', userId: 'u-1', traits: {} })
      await testDestination.testAction('identifyUser', { event, settings: SETTINGS, useDefaultMappings: true })

      expect((cap.body().attributes as Record<string, unknown>)['segment.event_type']).toBe('identify')
    })

    it('should set segment.event_type to "page" for page events', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({ type: 'page', name: 'Home' })
      await testDestination.testAction('trackPageView', { event, settings: SETTINGS, useDefaultMappings: true })

      expect((cap.body().attributes as Record<string, unknown>)['segment.event_type']).toBe('page')
    })

    it('should set segment.event_type to "group" for group events', async () => {
      const cap = captureBody()
      nock(BASE_URL).post(EVENTS_ENDPOINT, cap.intercept).reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({ type: 'group', groupId: 'g-1', traits: {} })
      await testDestination.testAction('trackGroupEvent', { event, settings: SETTINGS, useDefaultMappings: true })

      expect((cap.body().attributes as Record<string, unknown>)['segment.event_type']).toBe('group')
    })
  })

  // ── Default base URL ──────────────────────────────────────────────────────

  describe('default base URL', () => {
    it('should use https://telemetry.brizz.dev when baseUrl is not set', async () => {
      nock('https://telemetry.brizz.dev')
        .post(EVENTS_ENDPOINT, () => true)
        .reply(200, SUCCESS_RESPONSE)

      const event = createTestEvent({ type: 'track', event: 'Test' })

      const responses = await testDestination.testAction('trackEvent', {
        event,
        settings: { apiKey: 'test-key' },
        useDefaultMappings: true
      })

      expect(responses.length).toBe(1)
      expect(responses[0].status).toBe(200)
    })
  })
})
