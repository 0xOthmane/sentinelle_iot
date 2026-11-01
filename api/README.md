# Sentinelle API

Backend for the Sentinelle IoT project. It ingests sensor data from an MQTT broker, stores it in SQLite, evaluates alert thresholds, and exposes an authenticated HTTP + WebSocket API to the mobile app.

- **Runtime:** Node.js 20+ (LTS), TypeScript, ESM (`"type": "module"`)
- **HTTP:** [Hono](https://hono.dev) + `@hono/node-server`, `@hono/node-ws`
- **Storage:** SQLite via `better-sqlite3` (WAL mode)
- **Messaging:** `mqtt` (MQTT v5, TLS), tested with HiveMQ Cloud
- **Validation / security:** `zod`, JWT (HS256), `hono-rate-limiter`

## Run it

```bash
cd api
cp .env.example .env     # then edit it (see below)
npm install
npm run dev              # tsx watch → http://localhost:3000
```

| Script | What it does |
|--------|--------------|
| `npm run dev` | Starts the API with auto-reload (`tsx watch src/index.ts`). **Use this.** |
| `npm run build` | Type-checks and emits `dist/` with `tsc`. |
| `npm start` | `node dist/index.js`. ⚠️ Currently fails with `ERR_MODULE_NOT_FOUND` (see [Known issues](#known-issues)). |
| `npm test` | Runs `vitest`; there are no test files yet. |

Health check: `GET /health` → `{ "status": "ok", "uptime": …, "timestamp": … }`.

## Configuration

All settings are environment variables, loaded from `.env` ([src/config.ts](./src/config.ts)).

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `PORT` | | `3000` | HTTP/WebSocket port. |
| `MQTT_BROKER_URL` | ✅ | — | e.g. `mqtts://<cluster>.s1.eu.hivemq.cloud:8883`. |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | ✅ | — | Broker credentials (needs publish **and** subscribe on `sentinelle/#`). |
| `DB_PATH` | | `./sentinelle.db` | SQLite file, created on first start. Delete it to reset all data. |
| `APP_PASSWORD` | ✅ | — | Shared family password used by `POST /auth/login`. Login returns 500 if empty. |
| `JWT_SECRET` | ✅ | — | Secret signing the JWTs. 32+ random characters. |
| `JWT_EXPIRES_SECONDS` | | `2592000` (30 d) | Token lifetime. |
| `WS_TICKET_TTL_SECONDS` | | `30` | Lifetime of the one-time WebSocket ticket. |
| `RATE_LIMIT_LOGIN_WINDOW_MS` / `RATE_LIMIT_LOGIN_MAX` | | `900000` / `5` | Failed-login limit per client IP (successful logins are not counted). |
| `RATE_LIMIT_API_WINDOW_MS` / `RATE_LIMIT_API_MAX` | | `60000` / `120` | Limit for `/devices/*` and `/ws-ticket` per client IP. |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Fixed in code: devices are marked offline after 120 s without data (checked every 30 s); the default measurement lookback is 600 s.

## HTTP API

Everything except `/health`, `/auth/login` and the WebSocket upgrade requires `Authorization: Bearer <jwt>`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/login` | Body `{ "password": string }` → `{ token, tokenType, expiresIn, expiresAt }`. `401` wrong password, `429` rate limited. |
| `GET` | `/ws-ticket` | → `{ ticket, expiresIn }`. Single-use ticket for the WebSocket. |
| `GET` | `/devices` | → `[{ id, group, status, lastSeen }]`. |
| `GET` | `/devices/:id/measurements?from&to&step` | Unix-second bounds (default: last 600 s). With `step` (s) values are averaged per bucket. Returns `[{ ts, t, h }]`; `t`/`h` can be `null`. |
| `GET` | `/devices/:id/thresholds` | → `{ tMin, tMax, hMin, hMax, holdMinutes }`. **All-null bounds + `holdMinutes: 1` mean "not configured"** (no alerting yet). |
| `PUT` | `/devices/:id/thresholds` | Body as above. Rules: `tMin < tMax`; humidity bounds 0–100 or `null`, `hMin < hMax`; `holdMinutes` integer 1–120. The device must already exist (it has published at least once). |
| `GET` | `/devices/:id/alerts/active` | → `[{ device, kind, value, threshold, ts }]`. |
| `POST` | `/devices/:id/commands` | Body `{ "led": boolean, … }` (extra fields are forwarded). Publishes to MQTT. → `202 { sent: boolean }`, `404` unknown device. |

Alert `kind` is one of `tMin`, `tMax`, `hMin`, `hMax`.

### WebSocket

1. `GET /ws-ticket` (with the JWT) → `ticket`.
2. Connect to `wss://<host>/ws?ticket=<ticket>` within `WS_TICKET_TTL_SECONDS`. Tickets are single-use (React Native WebSockets cannot send headers).

Frames are JSON objects with a `type`:

| `type` | Payload | When |
|--------|---------|------|
| `snapshot` | `{ alerts: [...], ts }` | Right after connecting: all currently active alerts. |
| `measurement` | `{ device, ts, t, h }` | Every telemetry message. |
| `device_status` | `{ device, status }` | Device went online/offline. |
| `alert` | `{ device, ts, kind, value, threshold }` | A violation lasted `holdMinutes`. |
| `alert_cleared` | `{ device, ts, kind }` | Value back in range. |

## MQTT contract

The sensor (ESP32) and the API share these topics. `<group>` and `<deviceId>` are free-form (e.g. `groupe5` / `esp-05`) and must match `EXPO_PUBLIC_GROUP_NAME` / `EXPO_PUBLIC_DEVICE_ID` in the app.

| Direction | Topic | Payload |
|-----------|-------|---------|
| device → API | `sentinelle/<group>/<deviceId>/telemetry` | `{ "ts": <unix seconds>, "t": <°C>, "h": <%RH>, "seq": <int, optional> }` — `ts`, `t`, `h` must be numbers. |
| device → API | `sentinelle/<group>/<deviceId>/status` | `online` / `offline`, or `{ "status": "online" }`. |
| API → device | `sentinelle/<group>/<deviceId>/cmd` | e.g. `{ "id": "c-…", "led": true }` (QoS 1). |

A telemetry or status message auto-creates the device. Alerts are evaluated against the **device-provided `ts`**, not the arrival time.

## Data model

SQLite tables, created automatically on start ([src/db/schema.ts](./src/db/schema.ts)): `devices`, `measurements` (unique per `device, ts, seq`), `thresholds`, `events` (alert/status/command history), `alert_states` (durable violation tracking, survives restarts).

## Code map

```
src/
├── index.ts            app wiring, routes, boot/shutdown
├── config.ts           environment variables
├── routes/             one file per HTTP resource
├── middleware/         requireAuth (JWT), rateLimit
├── services/           ingestion, alert evaluation, aggregation, offline detection
├── mqtt/               client, message handlers, command publisher
├── ws/                 WebSocket upgrade, client manager, one-time tickets
├── db/                 connection, schema, repositories
└── utils/              JWT/password helpers, zod schemas
```

## Testing manually

See the full checklist in [../DEPLOYMENT.md](../DEPLOYMENT.md#6-test-checklist). In short:

```powershell
# PowerShell
$base = "http://localhost:3000"
$token = (Invoke-RestMethod "$base/auth/login" -Method Post -ContentType application/json `
  -Body (@{ password = "<APP_PASSWORD>" } | ConvertTo-Json)).token
Invoke-RestMethod "$base/devices" -Headers @{ Authorization = "Bearer $token" }
```

## Known issues

- **`npm start` fails.** Most relative imports (`"../config"`, `"./manager"`, …) have no `.js` extension, which Node's ESM loader requires; `tsx` tolerates it. Fix: add `.js` to every relative import (as `src/index.ts` already does), then `npm run build && npm start`.
- **Command acks are not handled.** The API doesn't subscribe to an ack topic or emit `command_status`, so the app never gets a confirmation (see the root [README](../README.md#known-limitations)).
- **Unknown device on `PUT /thresholds`** returns a 500 (foreign-key error) instead of a 404.
- **CORS is wide open** (`cors()` with defaults) and there is a single shared password: fine for a private demo, not for production.
