# Sentinelle IoT — "Petit Nid"

A baby-room monitor. An ESP32 sensor measures temperature and humidity, an API stores the data and raises alerts, and a mobile app shows the room state, history and alerts, and controls a night light.

```
┌────────────┐   MQTT (TLS)    ┌──────────────┐   HTTPS + WSS   ┌────────────────┐
│  ESP32     │ ──────────────▶ │  HiveMQ      │ ──────────────▶ │  API (Hono)    │
│  sensor +  │ ◀────────────── │  Cloud       │ ◀────────────── │  SQLite + WS   │
│  night LED │   commands      │  (broker)    │                 └───────┬────────┘
└────────────┘                 └──────────────┘                         │ tunnel (ngrok…)
                                                                        ▼
                                                                ┌────────────────┐
                                                                │  Expo app      │
                                                                │  (Android/iOS) │
                                                                └────────────────┘
```

| Part | Folder | Stack | Docs |
|------|--------|-------|------|
| Mobile app | [expo-app/](./expo-app) | Expo SDK 57, React Native 0.86, Expo Router, expo-sqlite | [expo-app/README.md](./expo-app/README.md) |
| Backend API | [api/](./api) | Node.js, Hono, better-sqlite3, MQTT.js, zod | [api/README.md](./api/README.md) |


The ESP32 firmware is **not** part of this repository. It only has to follow the MQTT contract described in [api/README.md](./api/README.md#mqtt-contract).

## How it works

1. The sensor publishes `{ts, t, h}` to `sentinelle/<group>/<deviceId>/telemetry` on the MQTT broker.
2. The API subscribes, stores every measurement in SQLite and broadcasts it over WebSocket.
3. For each measurement the API compares values to the device's thresholds. A threshold that stays violated for `holdMinutes` raises an **alert**; returning to range clears it.
4. The app signs in with a shared family password (JWT), loads data over HTTP, and receives live updates over a WebSocket opened with a one-time ticket.
5. When an alert fires, the app journals it, can show a local notification, and turns the night light on (`POST /devices/:id/commands` → MQTT `.../cmd`). When the alert clears, it turns the light off again only if automation turned it on.
6. The app caches everything in a local SQLite database, so it keeps working offline: cached charts, queued LED commands and queued threshold edits are replayed on reconnect.

## Quick start (local, no phone build)

Prerequisites: Node.js 20+ (LTS), npm, a free [HiveMQ Cloud](https://www.hivemq.com/mqtt-cloud-broker/) cluster.

```bash
# 1. API
cd api
cp .env.example .env        # fill MQTT_*, APP_PASSWORD, JWT_SECRET
npm install
npm run dev                 # http://localhost:3000

# 2. Mobile app (second terminal)
cd expo-app
cp .env.example .env        # set EXPO_PUBLIC_API_URL to a URL your phone can reach
npm install
npx expo start --tunnel     # scan the QR code with Expo Go
```


## Repository layout

```
sentinelle_iot/
├── README.md            ← you are here
├── api/                 ← backend (see api/README.md)
├── expo-app/            ← mobile app (see expo-app/README.md)
```

## Known limitations

These come from reading the code; they are worth knowing before a demo.

- **Production build of the API is broken.** `npm run build && npm start` fails with `ERR_MODULE_NOT_FOUND`: the project is ESM (`"type": "module"`) but most relative imports lack the `.js` extension. Run the API with `npm run dev` (tsx) until that is fixed.
- **Command acknowledgements are not implemented server-side.** The app waits for a WebSocket `command_status`/`acked` frame, but the API never subscribes to an ack topic nor emits that frame. The night-light switch therefore stays on "waiting for confirmation", and `sent` commands are re-sent on every reconnect.
- **`PUT /devices/:id/thresholds` needs a known device.** The `thresholds` table has a foreign key on `devices`, so saving thresholds for a device that has never published returns a 500. The app keeps the values locally and retries on the next sync.

## Security notes

- Never commit `.env` files (both apps already git-ignore them). `EXPO_PUBLIC_*` values are embedded in the app bundle and are **public**.
- Authentication is a single shared password. Use a strong `APP_PASSWORD` and a random `JWT_SECRET` (32+ characters) before exposing the API through a tunnel.
- Login is rate limited per client IP (5 failed attempts / 15 min by default).
