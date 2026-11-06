# Petit Nid — mobile app

Expo / React Native app for the Sentinelle IoT project: live temperature and humidity, history charts, alert journal, threshold settings and a night-light switch. It talks to the [API](../api/README.md) and keeps working offline thanks to a local SQLite cache.

- **Expo SDK 57**, React Native 0.86, React 19, TypeScript (strict), Expo Router (file-based routes, typed routes)
- **Local storage:** `expo-sqlite` (cache, command queue, journal) and `expo-secure-store` (JWT)
- **Network status:** `@react-native-community/netinfo`
- **Monitoring:** Sentry (`@sentry/react-native`, SDK-57 compatible `~7.11`)

## Run it

```bash
cd expo-app
cp .env.example .env     # set EXPO_PUBLIC_API_URL (see below)
npm install
npx expo start --tunnel  # `npm start` does the same
```

Then scan the QR code with **Expo Go** (Android/iOS, version matching SDK 57). The `--tunnel` flag lets a phone on another network reach the dev server.

| Script | Description |
|--------|-------------|
| `npm start` | `expo start --tunnel` |
| `npm run android` / `ios` / `web` | Start and open the platform |
| `npm run lint` | `expo lint` (ESLint with `eslint-config-expo`) |

Other useful checks: `npx tsc --noEmit` (types), `npx expo-doctor` (dependency/config problems), `npx expo install --fix` (align dependency versions with the SDK).


## Configuration

Settings are `EXPO_PUBLIC_*` variables, **inlined into the bundle at build time** (so they are public; never put secrets here). Fallbacks are in [src/constants/config.ts](./src/constants/config.ts).

| Variable | Fallback | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_API_URL` | `http://localhost:3003` | API base URL, no trailing slash. Must be reachable from the phone; use the **https** tunnel URL for release/APK builds (Android blocks cleartext http). |
| `EXPO_PUBLIC_WS_URL` | API URL with `http`→`ws` + `/ws` | WebSocket URL. Normally leave unset. |
| `EXPO_PUBLIC_DEVICE_ID` | `esp-05` | Sensor id; must match the MQTT topic. |
| `EXPO_PUBLIC_GROUP_NAME` | `groupe5` | Sensor group; must match the MQTT topic. |
| `EXPO_PUBLIC_APP_NAME` | `Petit Nid` | Title shown in the UI. |

Restart `expo start` (with `--clear` if needed) after changing `.env`. **EAS cloud builds do not read your local `.env`** — define the variables in the EAS `preview` environment.

Background alerts use Expo push notifications. They require notifications permission, a configured Expo/EAS project, and an installable native build; Expo Go may not provide the required native module. The app registers the push token when notifications are enabled and removes it when they are disabled.

`app.json` holds the app identity (`scheme: petit-nid`, Android package `iot.sentinelle.grp05`, EAS project id) and plugins. `eas.json` defines the build profiles: `development`, `preview` (installable APK, internal distribution) and `production`.

## Screens

| Route | File | Purpose |
|-------|------|---------|
| `/login` | `src/app/login.tsx` | Password sign-in (JWT stored in SecureStore). |
| `/(tabs)` | `src/app/(tabs)/index.tsx` | Room state card, live values, thresholds summary, night light, 10-minute chart. |
| `/history` | `src/app/(tabs)/history.tsx` | 1 h / 24 h / 7 d charts and min/avg/max stats. |
| `/journal` | `src/app/(tabs)/journal.tsx` | Alerts, device status, commands, threshold changes. |
| `/settings` | `src/app/(tabs)/settings.tsx` | Thresholds, hold delay, notifications, logout, debug tools. |

`src/app/_layout.tsx` wraps everything in `AuthProvider` → `SentinelleProvider` and redirects to `/login` when there is no token.

## Architecture

```
src/
├── app/              Expo Router routes (screens only)
├── components/       presentational components (cards, charts, shell)
├── hooks/            all stateful logic (see below)
├── state/            React contexts + SentinelleProvider
├── auth/             AuthContext/AuthProvider + SecureStore token helpers
├── api/              client.ts (HTTP, typed errors) · websocket.ts (ticket-authed socket)
├── db/               expo-sqlite access: cache, commands queue, journal, thresholds, settings
├── constants/        config.ts (env), theme.ts
├── utils/            format, thresholds parsing, logger, notifications loader
└── types.ts
```

### Hooks (`src/hooks/`)

Screens read two contexts through thin hooks; the logic lives in focused domain hooks composed by one controller.

| Hook | Responsibility |
|------|----------------|
| `useAuth` | Reads `AuthContext` (`token`, `isReady`, `login`, `logout`). |
| `useSentinelle` | Reads the main context (status, history, thresholds, alerts, journal, actions). |
| `useSentinelleLive` | Reads the **live** context (latest `temperature`, `humidity`, 10-minute series). Separate so only screens that need it re-render on every sensor frame. |
| `useSentinelleController` | Composes the hooks below and builds both context values. |
| `useConnectivity` | App lifecycle: cache bootstrap, NetInfo / AppState / login-logout transitions, WebSocket connect, automatic retry after transient disconnects, and teardown. |
| `useConnectionState` | `networkConnected` / `backendOnline` state plus refs for async callbacks. |
| `useMeasurements` | Live + history series, range selection, cache fallbacks. |
| `useThresholds` | Threshold form, save (online/offline), dirty replay, pushing defaults to an unconfigured server. |
| `useCommandQueue` | Night-light state, persistent command queue, alert automation (auto ON / auto OFF). |
| `useAlertSync` | Active alert state; reconciles WS snapshot / HTTP alerts with the journal. |
| `useDeviceStatus` | Sensor online/offline. |
| `useJournal`, `useNotifications` | Journal list; local-notification permission and sending. |
| `usePulse`, `useRoomState` | UI helpers: alert pulse animation and the room-state card. |

### Data flow

1. **Start:** open SQLite → show cached data immediately → wait for SecureStore authentication hydration → `refreshAll` (devices, live, history, thresholds, alerts) → open the WebSocket only when a session token is available.
2. **Live:** the socket asks `GET /ws-ticket`, connects, then streams `measurement`, `alert`, `alert_cleared`, `device_status` frames. A transient socket failure is retried with backoff while the network is available. Every measurement frame is also cached.
3. **Offline:** NetInfo flips `networkConnected`; screens show cached charts; LED commands and threshold edits are stored and replayed on reconnect or when the socket opens.
4. **Session:** a `401` from any call clears the token and the router guard returns to `/login`.

### Threshold behavior

If the API reports a device as *unconfigured* (all-null bounds), the app saves its defaults (18–26 °C, 35–70 %, 1 min) as a pending edit and pushes them, so what the UI shows is what the server enforces. Local unsynced edits always win over the server copy until replayed.

## Testing

Static checks:

```bash
npx expo lint
npx tsc --noEmit
npx expo-doctor
```

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| "Serveur injoignable" on login | `EXPO_PUBLIC_API_URL` wrong or not reachable from the phone; open it in the phone's browser (`/health`). |
| Works in Expo Go, not in the APK | The APK was built without the env vars (cloud builds ignore `.env`) or uses `http://`. |
| Stays on "Reconnexion" / "CACHE" | Check the diagnostic status in Settings. It should progress through `token ok` → `ticket 200` → `open`; if it remains at `authentification…`, SecureStore hydration has not completed, and if `ticket…` never reaches the API, rebuild with the current client lifecycle code. Also check that the API log shows `[WS] Client connected`. |
| Alerts never fire | Thresholds not saved on the server, or the sensor `ts` values are not advancing; see the checklist. |
| Night light stays "waiting for confirmation" | Known limitation: the API does not acknowledge commands yet. |
| Version warnings at startup | Run `npx expo install --fix` and rebuild the native app. |
| Notifications unavailable | Expo Go / old dev build lacks the native module; use an EAS build. |
