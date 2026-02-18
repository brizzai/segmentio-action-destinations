# Brizz Destination

Send Segment events to [Brizz](https://brizz.dev) for observability, analytics, and session replay.

## Actions

| Action            | Trigger             | Brizz event name                 | Brizz event body          |
| ----------------- | ------------------- | -------------------------------- | ------------------------- |
| `trackEvent`      | `type = "track"`    | `event` (e.g. "Order Completed") | `properties`              |
| `identifyUser`    | `type = "identify"` | `"identify"`                     | `traits`                  |
| `trackPageView`   | `type = "page"`     | `"page.{name}"` or `"page_view"` | `properties` + `category` |
| `trackGroupEvent` | `type = "group"`    | `"group"`                        | `{ group_id, ...traits }` |

All actions support batching (up to 100 events per request).

### Field mappings

Each action extracts these fields from the incoming Segment event via `@path` mappings. Users can customize these in the Segment UI.

| Segment field   | Action field  | Maps to in Brizz event                                                                                     |
| --------------- | ------------- | ---------------------------------------------------------------------------------------------------------- |
| `$.event`       | `name`        | `name` — the event name                                                                                    |
| `$.properties`  | `properties`  | `body` — free-form event payload                                                                           |
| `$.traits`      | `traits`      | `body` — user or group traits (identify/group actions)                                                     |
| `$.userId`      | `userId`      | `attributes["brizz.user_id"]`                                                                              |
| `$.anonymousId` | `anonymousId` | `attributes["segment.anonymous_id"]`                                                                       |
| `$.timestamp`   | `timestamp`   | `timestamp` — ISO 8601                                                                                     |
| `$.messageId`   | `messageId`   | `attributes["segment.message_id"]`                                                                         |
| `$.context`     | `context`     | Extracts: `sessionId`, `page.url`, `page.path`, `page.referrer`, `page.title`, `userAgent`, `locale`, `ip` |
| `$.groupId`     | `groupId`     | Included as `group_id` in `body` (group action only)                                                       |
| `$.category`    | `category`    | Included in `body` (page action only)                                                                      |

## Brizz Event Schema

Each action transforms a Segment event into a Brizz event and sends it to `POST {baseUrl}/raw/events`. The outgoing payload follows this schema:

```jsonc
{
  "name": "Order Completed", // REQUIRED – event name
  "service_name": "my-app", // REQUIRED – from settings.serviceName
  "session_id": "anon-456", // REQUIRED – see resolution order below
  "timestamp": "2026-01-15T10:30:00Z", // REQUIRED – ISO 8601
  "source": "segment", // always "segment"
  "environment": "production", // from settings.environment
  "severity_number": 9, // OTel severity (default: 9 = INFO)
  "attributes": {
    // structured metadata
    "brizz.user_id": "user-123",
    "segment.anonymous_id": "anon-456",
    "segment.message_id": "msg-001",
    "segment.event_type": "track",
    "page.url": "https://example.com",
    "page.path": "/checkout",
    "page.referrer": "https://google.com",
    "page.title": "Checkout",
    "user_agent": "Mozilla/5.0",
    "locale": "en-US",
    "ip": "1.2.3.4"
  },
  "body": { "revenue": 99.99 } // event properties or user traits
}
```

### session_id

The `session_id` field ties events into a user session in Brizz. Resolution order:

1. `context.sessionId` — the recommended way to provide a session ID
2. `properties.sessionId` (or `traits.sessionId` for identify/group events) — fallback
3. Empty string `""` — if none of the above are present

```js
analytics.track(
  'Order Completed',
  { revenue: 99.99 },
  {
    context: { sessionId: 'sess_abc123' }
  }
)
```

### severity_number

OTel severity levels (0–24). Omit to default to 9 (INFO).

| Range | Level          |
| ----- | -------------- |
| 1–4   | TRACE          |
| 5–8   | DEBUG          |
| 9–12  | INFO (default) |
| 13–16 | WARN           |
| 17–20 | ERROR          |
| 21–24 | FATAL          |

## Local Development

### Prerequisites

From the repository root:

```sh
yarn install
yarn build
```

### Environment Variables

Create a `.env` file at the repository root (it is already gitignored):

```sh
# .env
BRIZZ_API_KEY=brizz-ing_your_api_key
BRIZZ_SERVICE_NAME=my-app
BRIZZ_ENVIRONMENT=development
# Override the telemetry endpoint for local or self-hosted environments.
# Defaults to https://telemetry.brizz.dev when omitted.
# For local development against Brizz (port 4002):
BRIZZ_BASE_URL=http://localhost:4002/api/v1/telemetry
```

## Testing

### Unit Tests

```sh
# Run all Brizz tests
cd packages/destination-actions
npx jest --testPathPattern='src/destinations/brizz' --no-coverage

# Update snapshots after adding or modifying actions
npx jest --testPathPattern='src/destinations/brizz' --updateSnapshot
```

Tests use `nock` to intercept outbound HTTP requests so no real API calls are made.

### Snapshot Tests

Snapshot tests are auto-generated under `__tests__/__snapshots__/`. They verify that field definitions and request payloads remain stable across changes. If you intentionally modify a field or the request body, re-run with `--updateSnapshot` and review the diff.

## Local E2E Testing

Start the local development server:

```sh
./bin/run serve
```

Select **Brizz** from the menu. The server starts on port `3000` by default (override with `PORT=3001 ./bin/run serve`).

### Test Authentication

Verifies your API key against the Brizz API. Note: `/authenticate` expects fields at the root level (no `settings` wrapper).

```sh
curl -X POST http://localhost:3000/authenticate \
  -H 'Content-Type: application/json' \
  -d '{
    "baseUrl": "'"$BRIZZ_BASE_URL"'",
    "apiKey": "'"$BRIZZ_API_KEY"'",
    "serviceName": "'"$BRIZZ_SERVICE_NAME"'",
    "environment": "'"$BRIZZ_ENVIRONMENT"'"
  }'
```

A `200` response with `{"ok": true}` means the credentials are valid.

### Track Event

```sh
curl -X POST http://localhost:3000/trackEvent \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {
      "baseUrl": "'"$BRIZZ_BASE_URL"'",
      "apiKey": "'"$BRIZZ_API_KEY"'",
      "serviceName": "'"$BRIZZ_SERVICE_NAME"'",
      "environment": "'"$BRIZZ_ENVIRONMENT"'"
    },
    "mapping": {
      "name":        { "@path": "$.event" },
      "properties":  { "@path": "$.properties" },
      "userId":      { "@path": "$.userId" },
      "anonymousId": { "@path": "$.anonymousId" },
      "timestamp":   { "@path": "$.timestamp" },
      "messageId":   { "@path": "$.messageId" },
      "context":     { "@path": "$.context" }
    },
    "payload": {
      "type": "track",
      "event": "Order Completed",
      "userId": "user-123",
      "anonymousId": "anon-456",
      "timestamp": "2026-01-15T10:30:00.000Z",
      "messageId": "msg-001",
      "properties": {
        "revenue": 99.99,
        "currency": "USD"
      },
      "context": {
        "sessionId": "sess_abc123",
        "page": { "url": "https://example.com/checkout", "path": "/checkout" },
        "userAgent": "Mozilla/5.0",
        "locale": "en-US"
      }
    }
  }'
```

This produces the following Brizz event:

```json
{
  "name": "Order Completed",
  "service_name": "my-app",
  "session_id": "sess_abc123",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "source": "segment",
  "environment": "development",
  "severity_number": 9,
  "attributes": {
    "brizz.user_id": "user-123",
    "segment.anonymous_id": "anon-456",
    "segment.message_id": "msg-001",
    "segment.event_type": "track",
    "page.url": "https://example.com/checkout",
    "page.path": "/checkout",
    "user_agent": "Mozilla/5.0",
    "locale": "en-US"
  },
  "body": { "revenue": 99.99, "currency": "USD" }
}
```

### Track Event (Batch)

Send `payload` as an array to invoke `performBatch`:

```sh
curl -X POST http://localhost:3000/trackEvent \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {
      "baseUrl": "'"$BRIZZ_BASE_URL"'",
      "apiKey": "'"$BRIZZ_API_KEY"'",
      "serviceName": "'"$BRIZZ_SERVICE_NAME"'",
      "environment": "'"$BRIZZ_ENVIRONMENT"'"
    },
    "mapping": {
      "name":        { "@path": "$.event" },
      "properties":  { "@path": "$.properties" },
      "userId":      { "@path": "$.userId" },
      "anonymousId": { "@path": "$.anonymousId" },
      "timestamp":   { "@path": "$.timestamp" },
      "messageId":   { "@path": "$.messageId" },
      "context":     { "@path": "$.context" }
    },
    "payload": [
      {
        "type": "track",
        "event": "Product Viewed",
        "userId": "user-1",
        "timestamp": "2026-01-15T10:30:00.000Z",
        "properties": { "product_id": "sku-100" },
        "context": { "sessionId": "sess_abc123" }
      },
      {
        "type": "track",
        "event": "Product Added",
        "userId": "user-2",
        "timestamp": "2026-01-15T10:31:00.000Z",
        "properties": { "product_id": "sku-200" },
        "context": { "sessionId": "sess_abc123" }
      }
    ]
  }'
```

### Identify User

```sh
curl -X POST http://localhost:3000/identifyUser \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {
      "baseUrl": "'"$BRIZZ_BASE_URL"'",
      "apiKey": "'"$BRIZZ_API_KEY"'",
      "serviceName": "'"$BRIZZ_SERVICE_NAME"'",
      "environment": "'"$BRIZZ_ENVIRONMENT"'"
    },
    "mapping": {
      "traits":      { "@path": "$.traits" },
      "userId":      { "@path": "$.userId" },
      "anonymousId": { "@path": "$.anonymousId" },
      "timestamp":   { "@path": "$.timestamp" },
      "messageId":   { "@path": "$.messageId" },
      "context":     { "@path": "$.context" }
    },
    "payload": {
      "type": "identify",
      "userId": "user-789",
      "anonymousId": "anon-456",
      "traits": {
        "email": "user@example.com",
        "name": "Jane Doe",
        "plan": "enterprise"
      },
      "timestamp": "2026-01-15T10:30:00.000Z",
      "context": { "sessionId": "sess_abc123" }
    }
  }'
```

Produces:

```json
{
  "name": "identify",
  "service_name": "my-app",
  "session_id": "sess_abc123",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "source": "segment",
  "severity_number": 9,
  "attributes": {
    "brizz.user_id": "user-789",
    "segment.anonymous_id": "anon-456",
    "segment.event_type": "identify"
  },
  "body": { "email": "user@example.com", "name": "Jane Doe", "plan": "enterprise" }
}
```

### Track Page View

```sh
curl -X POST http://localhost:3000/trackPageView \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {
      "baseUrl": "'"$BRIZZ_BASE_URL"'",
      "apiKey": "'"$BRIZZ_API_KEY"'",
      "serviceName": "'"$BRIZZ_SERVICE_NAME"'",
      "environment": "'"$BRIZZ_ENVIRONMENT"'"
    },
    "mapping": {
      "name":        { "@path": "$.name" },
      "category":    { "@path": "$.category" },
      "properties":  { "@path": "$.properties" },
      "userId":      { "@path": "$.userId" },
      "anonymousId": { "@path": "$.anonymousId" },
      "timestamp":   { "@path": "$.timestamp" },
      "messageId":   { "@path": "$.messageId" },
      "context":     { "@path": "$.context" }
    },
    "payload": {
      "type": "page",
      "name": "Homepage",
      "userId": "user-123",
      "anonymousId": "anon-456",
      "properties": {
        "url": "https://example.com",
        "path": "/",
        "title": "Home"
      },
      "timestamp": "2026-01-15T10:30:00.000Z",
      "context": { "sessionId": "sess_abc123" }
    }
  }'
```

Produces:

```json
{
  "name": "page.Homepage",
  "service_name": "my-app",
  "session_id": "sess_abc123",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "source": "segment",
  "severity_number": 9,
  "attributes": {
    "brizz.user_id": "user-123",
    "segment.anonymous_id": "anon-456",
    "segment.event_type": "page"
  },
  "body": { "category": null, "url": "https://example.com", "path": "/", "title": "Home" }
}
```

### Track Group Event

```sh
curl -X POST http://localhost:3000/trackGroupEvent \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {
      "baseUrl": "'"$BRIZZ_BASE_URL"'",
      "apiKey": "'"$BRIZZ_API_KEY"'",
      "serviceName": "'"$BRIZZ_SERVICE_NAME"'",
      "environment": "'"$BRIZZ_ENVIRONMENT"'"
    },
    "mapping": {
      "groupId":     { "@path": "$.groupId" },
      "traits":      { "@path": "$.traits" },
      "userId":      { "@path": "$.userId" },
      "anonymousId": { "@path": "$.anonymousId" },
      "timestamp":   { "@path": "$.timestamp" },
      "messageId":   { "@path": "$.messageId" },
      "context":     { "@path": "$.context" }
    },
    "payload": {
      "type": "group",
      "groupId": "group-123",
      "userId": "user-456",
      "anonymousId": "anon-456",
      "traits": {
        "name": "Acme Corp",
        "plan": "enterprise",
        "employees": 120
      },
      "timestamp": "2026-01-15T10:30:00.000Z",
      "context": { "sessionId": "sess_abc123" }
    }
  }'
```

Produces:

```json
{
  "name": "group",
  "service_name": "my-app",
  "session_id": "sess_abc123",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "source": "segment",
  "severity_number": 9,
  "attributes": {
    "brizz.user_id": "user-456",
    "segment.anonymous_id": "anon-456",
    "segment.event_type": "group"
  },
  "body": { "group_id": "group-123", "name": "Acme Corp", "plan": "enterprise", "employees": 120 }
}
```

## Actions Tester UI

For an interactive testing experience, start the server without the `-n` flag:

```sh
./bin/run serve
```

Select **Brizz**, then open `http://localhost:3000` in your browser. The UI renders the settings and mapping fields and lets you send test events with a single click.

## Troubleshooting

| Symptom                                                 | Fix                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `401 Unauthorized` from Brizz                           | Verify `apiKey` is correct and starts with `brizz-ing`.                                           |
| Snapshot test diff after field change                   | Re-run with `--updateSnapshot` and commit the updated `.snap` file.                               |
| `ts-jest` version warnings                              | Safe to ignore. The repo uses Jest 30 which is ahead of ts-jest's tested range. Tests still pass. |
| `Cannot find module '@segment/actions-core'` with `tsc` | Run `yarn build` from the repo root first. Unit tests via `jest` work without a prior build.      |
