# Brizz Destination

Send Segment events to [Brizz](https://brizz.dev) for observability, analytics, and session replay.

## Actions

| Action            | Trigger             | Description                      |
| ----------------- | ------------------- | -------------------------------- |
| `trackEvent`      | `type = "track"`    | Forward track events to Brizz    |
| `identifyUser`    | `type = "identify"` | Forward identify events to Brizz |
| `trackPageView`   | `type = "page"`     | Forward page events to Brizz     |
| `trackGroupEvent` | `type = "group"`    | Forward group events to Brizz    |

All actions support batching (up to 100 events per request).

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
# For local development against the Brizz gateway (port 4002):
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

Verifies your telemetry key against the Brizz API:

```sh
curl -X POST http://localhost:3000/authentication \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {
      "apiKey": "'"$BRIZZ_API_KEY"'",
      "serviceName": "'"$BRIZZ_SERVICE_NAME"'",
      "environment": "'"$BRIZZ_ENVIRONMENT"'"
    }
  }'
```

A `200` response means the credentials are valid.

### Track Event

```sh
curl -X POST http://localhost:3000/trackEvent \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {
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
        "page": { "url": "https://example.com/checkout", "path": "/checkout" },
        "userAgent": "Mozilla/5.0",
        "locale": "en-US"
      }
    }
  }'
```

### Track Event (Batch)

Send `payload` as an array to invoke `performBatch`:

```sh
curl -X POST http://localhost:3000/trackEvent \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {
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
        "properties": { "product_id": "sku-100" }
      },
      {
        "type": "track",
        "event": "Product Added",
        "userId": "user-2",
        "timestamp": "2026-01-15T10:31:00.000Z",
        "properties": { "product_id": "sku-200" }
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
      "traits": {
        "email": "user@example.com",
        "name": "Jane Doe",
        "plan": "enterprise"
      },
      "timestamp": "2026-01-15T10:30:00.000Z"
    }
  }'
```

### Track Page View

```sh
curl -X POST http://localhost:3000/trackPageView \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {
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
      "properties": {
        "url": "https://example.com",
        "path": "/",
        "title": "Home"
      },
      "timestamp": "2026-01-15T10:30:00.000Z"
    }
  }'
```

### Track Group Event

```sh
curl -X POST http://localhost:3000/trackGroupEvent \
  -H 'Content-Type: application/json' \
  -d '{
    "settings": {
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
      "traits": {
        "name": "Acme Corp",
        "plan": "enterprise",
        "employees": 120
      },
      "timestamp": "2026-01-15T10:30:00.000Z"
    }
  }'
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
