# TMap mobile

A new, independent native companion for the existing TMap Tesla-browser product. Built with React Native, Expo SDK 57, Expo Router, and strict TypeScript for iOS and Android. This repository does not contain or modify the TMap web/Lovable application.

## Current scope

- Connect screen: six-character pairing code, GE/AM market selection, validation, connection status, cancellation, and retry.
- Remote home: connection status, Disconnect, and placeholders for Speak Destination, Search Destination, Share Location, Control Map, and Speedometer.
- Typed service boundaries for pairing, realtime, location, voice, navigation, and remote-map control.
- Exact production `PairedFix`, `PairedNavState`, and `PairedView` interfaces in `src/types/protocol.ts`.
- Development-build configuration, native app assets, EAS profiles, tests, and CI.

**Production realtime pairing is implemented.** The native app uses the Supabase JavaScript client to join the existing Tesla broadcast channel, sends the production heartbeat, handles both disconnect directions, and reconnects after temporary failures. Set the existing project's public Supabase values to use it. All five remote actions remain Coming soon placeholders. No navigation engine, WebView, payments, GPS, microphone, navigation, or map-control functionality has been added.

## Connect to the existing Tesla product

1. Copy `.env.example` to `.env`. Keep `EXPO_PUBLIC_DEMO_MODE=false`.
2. Set `EXPO_PUBLIC_SUPABASE_URL` to the **same HTTPS Supabase project URL used by the production Tesla app**, and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to that project's modern `sb_publishable_...` client key. No new Supabase project or database migration is needed. The adapter uses the existing public broadcast channel; it does not add a pairing endpoint or sign-in flow.
3. Restart Metro after changing environment values, install/open TMap Dev, and enter the six-character code shown by the Tesla browser.
4. The code is normalized to uppercase in memory. The channel is exactly `pair-${code.toLowerCase()}`; market selection does not change it. The UI stays in a subscribing state until Supabase reports `SUBSCRIBED`.
5. After subscription, the UI says **Realtime connected** and the phone immediately broadcasts `heartbeat` with `{ t: Date.now() }`, then repeats every 2000 ms. A subscription/server acknowledgement confirms Realtime delivery, not that a Tesla is actually listening. This protocol does not supply a separate peer-presence acknowledgement, so the UI makes no such claim.

Missing or invalid configuration displays a safe error instead of pretending to connect. No production values are checked into source. HTTPS URLs must not contain credentials, query parameters, or fragments. Only modern `sb_publishable_` keys are accepted; secret keys and legacy JWT/service-role keys are rejected.

### Disconnect, reconnect, and lifecycle

- Incoming `disconnect` with `{ by: "tesla" }` stops heartbeat/retry work, removes the channel, clears the in-memory session, returns to Connect, and shows **Disconnected by Tesla**. Invalid payloads and `{ by: "phone" }` echoes cannot trigger this path.
- Phone Disconnect sends exactly `disconnect` / `{ by: "phone" }` on the subscribed socket. It stops further heartbeats and waits for a server acknowledgement for at most 500 ms, then removes the channel and clears the session. Cleanup finishes even when the network is unavailable; delivery cannot be guaranteed offline. Cleanup never echoes a Tesla disconnect.
- `CHANNEL_ERROR`, `TIMED_OUT`, or unexpected `CLOSED` immediately remove the ready state and stop heartbeat. The old dedicated channel/client is disposed before a replacement is created. Retries use 1, 2, 4, then 5-second delays, capped at 5 seconds; a successful subscription resets backoff and sends a fresh immediate heartbeat. Generation checks ignore late callbacks and prevent duplicate channels and timers.
- Tesla considers heartbeats stale after **6 seconds** and the session lost after **20 seconds**. The app enters reconnecting as soon as it observes a failure. If no acknowledged heartbeat was sent for 20 seconds (or the initial subscription cannot complete within 20 seconds), it clears the session and requires a code again. This avoids silently reviving a session the Tesla may already have discarded.
- When AppState becomes inactive/background, heartbeat and the socket are stopped. A foreground return within the loss window resubscribes; a longer absence returns to Connect. The foreground check uses wall-clock time because JavaScript timers may be suspended. Unmount removes the AppState listener and all connection resources without a phone-disconnect echo. There is **no background service or background execution guarantee** in this step.
- Pairing/session data is memory-only. Supabase Auth persistence, auto-refresh, and URL session detection are disabled. No AsyncStorage, secure-store persistence, auth login, or new native permissions are introduced.

### Developer diagnostics

Development builds display the pairing code, channel state, last acknowledged heartbeat's send time, received broadcast count, and reconnect attempt count. The section is hidden in release JavaScript. It never displays Supabase keys, URLs, tokens, or raw server errors. The code and counters are cleared on disconnect. Non-disconnect broadcasts are counted but not consumed by the placeholder navigation/location/map services.

## Local development

Use Node.js 22.13+ (Node 24 LTS recommended) and pnpm 11.25.0, as pinned in `package.json`. Install that pnpm version with your preferred Node package-manager setup, for example `npm install --global pnpm@11.25.0`.

From this repository root:

```sh
pnpm install --frozen-lockfile
```

Copy `.env.example` to `.env` (`cp .env.example .env` on macOS/Linux, or `Copy-Item .env.example .env` in PowerShell) and configure the public Supabase values above. You can also use the explicit offline demo below. Install a development build using the Android, iOS, or EAS instructions below, then start Metro:

```sh
pnpm start
```

`start` explicitly uses `expo start --dev-client`. **Use the installed TMap Dev application, not Expo Go.** There is also an Expo Go runtime guard. Native modules or app-config changes require rebuilding your development client; JavaScript/TypeScript changes use Metro/Fast Refresh.

### Explore the screens locally

Set `EXPO_PUBLIC_DEMO_MODE=true` in `.env`, restart Metro, and enter **TMAP26**. The demo uses in-memory adapters and is labeled on both screens. Switch GE/AM before pairing to exercise both markets. Disconnect clears the session and returns to the Connect screen. Pairing codes and sessions are not persisted or logged.

Demo mode is gated by React Native's `__DEV__`, so it is never enabled in release JavaScript. All EAS profiles default it to false, and release app configuration rejects `true`. The code `TMAP26` is a local demo fixture, not a production credential.

## Android development build

Install Android Studio, the Android SDK/emulator, and the JDK supported by the installed React Native/Expo version. Configure `ANDROID_HOME` and the platform-tools path, then start an emulator or connect a device with USB debugging.

```sh
pnpm android
```

This runs `expo run:android`, generates the native project, builds TMap Dev, and starts Metro. Use `pnpm android --device` for device selection. Windows, Linux, and macOS support local Android development with the required toolchain.

Alternatively, create an EAS development APK, install it using the EAS build link, then run `pnpm start`. A physical phone and Metro must be mutually reachable; use Expo's documented tunnel option if LAN access is unavailable.

## iOS development build

Local iOS compilation requires **macOS and Xcode** with its command-line tools and a compatible simulator/runtime. SDK 57 uses the Xcode 26 generation of build images by default. If choosing an Xcode 27 image, first follow Expo's SDK 57 scene-support guidance linked below.

```sh
pnpm ios
# Physical device, with Apple signing configured:
pnpm ios --device
```

Windows cannot compile iOS locally. Use EAS for an iOS device build; device signing requires your Apple Developer team and registered devices. The `development-simulator` profile builds for a simulator on a Mac without physical-device provisioning.

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `EXPO_PUBLIC_DEFAULT_MARKET` | Initial market, exactly `GE` or `AM`; users may switch before pairing | `GE` |
| `EXPO_PUBLIC_DEMO_MODE` | Explicit local demonstration, `true` or `false` | `false` |
| `EXPO_PUBLIC_SUPABASE_URL` | HTTPS URL of the existing production TMap Supabase project | Unset |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Modern `sb_publishable_...` client key for the same project | Unset |
| `TMAP_APP_VARIANT` | `development`, `preview`, or `production`; supplied by EAS profiles | `development` |
| `TMAP_IOS_BUNDLE_IDENTIFIER` | Base identifier owned by your organization | `com.example.tmap` for local dev only |
| `TMAP_ANDROID_PACKAGE` | Base package owned by your organization | `com.example.tmap` for local dev only |
| `EAS_PROJECT_ID` | UUID of the separate TMap mobile EAS project | Unset |
| `EXPO_OWNER` | Expo account or organization that owns the project | Unset |

The market default lives in `src/config/market.ts`. Reusable services receive `MarketContext` or a market-scoped session; they never assume Georgia. Changing market does not add or change any field in the production protocol payloads. UI text is currently English; locale metadata is ready for future localization.

`EXPO_PUBLIC_*` values are embedded in the client bundle and **cannot hold secrets**. Supabase publishable keys and build identifiers are public client metadata. Never use a service-role/admin key. `.env` files and signing files are ignored by Git; errors and diagnostics do not echo their values. Future privileged credentials must remain on the server.

## EAS build preparation

No cloud project, signing credentials, or app-store submission is created by this scaffold.

1. Create a **new mobile EAS project** under the correct Expo account. Do not link to the web/Lovable repository.
2. Run `pnpm dlx eas-cli login`, then `pnpm dlx eas-cli init`. Because configuration is dynamic, copy the resulting project UUID into `EAS_PROJECT_ID`; do not replace `app.config.ts` with a generated static config.
3. Set your owned base bundle/package identifiers and `EXPO_OWNER` in local `.env`. Set those values, `EAS_PROJECT_ID`, and both public Supabase variables in the corresponding EAS `development`, `preview`, and `production` environments using the EAS dashboard or `eas env:create`. Use the Supabase project that the target Tesla browser uses. These public values can use plaintext visibility so they are available during configuration/bundling. The mobile EAS project is separate; the Supabase project is the existing production project.
4. Check `pnpm expo:config` and `pnpm expo:doctor`. Native IDs gain `.dev` for development and `.preview` for preview, allowing installations to coexist; production uses the base identifiers unchanged. Names and URL schemes follow the same separation.
5. Run `pnpm check`, configure signing in EAS, and create the required build:

```sh
# Installable development clients
pnpm build:android:development
pnpm build:ios:development

# iOS simulator on a Mac
pnpm dlx eas-cli build --platform ios --profile development-simulator

# Internal release-mode review builds
pnpm dlx eas-cli build --platform all --profile preview

# Store binaries, after real integrations and release testing are complete
pnpm dlx eas-cli build --platform all --profile production
```

`development` includes `expo-dev-client`; Android development/preview produce APKs. Production Android produces an AAB, uses remote version management, and increments build versions automatically. Preview/production configuration fails early without explicit mobile app identifiers and an EAS project UUID. The release profiles are build preparation, not a claim that live product integration is complete. No EAS Update or automatic submission is configured.

Generated `android/` and `ios/` folders are ignored. EAS regenerates them from configuration using Expo Continuous Native Generation. Put future native configuration in app config/config plugins so it survives regeneration. Expo SDK 57 prebuild regenerates native folders by default; do not keep unrecorded hand edits there.

## Architecture

```text
index.ts                         Headless task bootstrap, then Expo Router
app.config.ts / eas.json          Native configuration and build variants
src/
  app/                           Thin Expo Router routes; protected remote screen
  screens/                       Connect and Remote native screens
  components/                    Accessible UI primitives and native SVG artwork
  config/                        Public environment parsing and market metadata
  types/market.ts                 Market = "GE" | "AM"
  types/protocol.ts               Exact production payloads and event names
  state/                         Testable connection controller and React provider
  services/
    pairing.ts                   Pairing validation, session and adapter contract
    realtime.ts                  Heartbeat, reconnect, pause/resume, teardown
    realtimeTypes.ts             Diagnostics and lifecycle contract
    supabase.ts                  RN Supabase client and exact broadcast mapping
    location.ts                  Foreground/background permissions and fix boundary
    voice.ts                     Destination recognition boundary
    navigation.ts                Requests/state for the existing navigation engine
    remoteMap.ts                 PairedView command boundary
    demo.ts                      Explicit in-memory demonstration adapters
    index.ts                     Adapter composition point
  background/registerTasks.ts    Reserved module-scope native task entry
tests/                           Protocol, lifecycle, configuration and UI tests
```

The connection controller is independent of React and can be tested with injected adapters. It handles duplicate submissions, bounded connection attempts, cancellation, late responses, channel failures, remote disconnects, and cleanup. It reports realtime-connected only from `SUBSCRIBED` diagnostics, never from code validation or an unqualified promise resolving. Router guards prevent opening `/remote` while disconnected, preserve a visibly paused/reconnecting remote screen during short interruptions, and remove it from history on disconnection. Sessions live only in memory and are discarded on reload.

### Protocol compatibility

`PairedFix`, `PairedNavState`, and `PairedView` preserve the supplied production fields, numeric types, nullable members, and mutable nested structures exactly. In particular, heading/speed, destination, and encodedPolyline retain their explicit nullability. These contracts are ready for later features; this step does not produce fixes, consume route state, or compute routes/reroutes.

The supported names remain `fix`, `nav`, `nav_clear`, `view`, `heartbeat`, and `disconnect`. `RemoteEvent` maps to Supabase's standard `{ type: "broadcast", event, payload }` API. Heartbeat is exactly `{ t: number }`; disconnect is exactly `{ by: "phone" | "tesla" }`. `nav_clear` remains opaque until that feature is implemented. Broadcast uses `ack: true`, `self: false`, and a public channel. Sending is guarded by subscription/socket readiness so Supabase cannot silently fall back to HTTP while offline. No custom websocket protocol, new event, database change, or Tesla engine change is required.

### Adding native background location next

1. Install SDK-compatible `expo-location` and `expo-task-manager` using `pnpm exec expo install expo-location expo-task-manager`.
2. Define the stable `tmap.background-location.v1` task at module scope in `src/background/registerTasks.ts`. It already loads before `expo-router/entry`. Delegate to a separate headless handler that does not require React context, navigation, or a mounted screen.
3. Implement the `LocationService` interface. Keep UI subscriptions separate from background delivery: the operating system can launch the task without the foreground application. Use a secure, durable session/consent store and a bounded queue with an explicit retention policy for headless delivery.
4. Add truthful permission descriptions, Expo Location config-plugin options, iOS background location mode, and Android background/foreground-service location permissions and notification setup. None are enabled yet. Rebuild the native development client.
5. Request foreground consent before background consent in response to user action. Honor denied/restricted permissions, sign-out, session expiry, and Disconnect; stop tasks and clear pending location data when sharing ends. Map platform readings into the exact `PairedFix` shape, retaining unknown heading/speed as null.
6. Validate on physical iOS and Android devices, including backgrounding, permission changes, connectivity loss, battery restrictions and process termination. Background execution is OS-controlled and is not guaranteed after a user force-quits the app.

## Quality checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm expo:check
pnpm expo:doctor
```

`pnpm check` runs typecheck, lint, and tests. CI repeats those checks on push/pull request. Tests cover exact Supabase mapping, subscription readiness, immediate/2-second heartbeat, server-ack failures, Tesla/phone disconnect, bounded flush, channel failure/reconnect, no duplicate subscriptions/timers, cancellation, lifecycle cleanup, 20-second expiry, code validation, both markets, protocol shape/nulls, diagnostics, and native screen/router flows. SDK/network boundaries are mocked; no tests require production credentials.

For a live acceptance check, use a physical development build and a real Tesla pairing code on the same Supabase project. Confirm Tesla receives heartbeats, test disconnect from each side, toggle networking briefly, then test an absence longer than 20 seconds. A passing mocked test suite does not establish a live Tesla connection.

Before shipping, additionally run a development build on real iOS/Android devices and check keyboard behavior, small screens, large system text, VoiceOver/TalkBack, and native navigation. JavaScript bundling and component tests do not substitute for native device validation.

## Reference documentation

- [Expo SDK 57 release and Xcode compatibility](https://expo.dev/changelog/sdk-57)
- [Expo Router installation and custom entry points](https://docs.expo.dev/router/installation/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS Build configuration](https://docs.expo.dev/build/eas-json/)
- [Expo Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/)
- [Expo TaskManager](https://docs.expo.dev/versions/v57.0.0/sdk/task-manager/)
- [Supabase React Native client setup](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [Supabase broadcast and server acknowledgements](https://supabase.com/docs/guides/realtime/broadcast)
