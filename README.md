# TMap mobile

A new, independent native companion for the existing TMap Tesla-browser product. Built with React Native, Expo SDK 57, Expo Router, and strict TypeScript for iOS and Android. This repository does not contain or modify the TMap web/Lovable application.

## Current scope

- Connect screen: six-character pairing code, GE/AM market selection, validation, connection status, cancellation, and retry.
- Remote home: connection status, Disconnect, native Share Location controls, and placeholders for Speak Destination, Search Destination, Control Map, and Speedometer.
- Typed service boundaries for pairing, realtime, location, voice, navigation, and remote-map control.
- Exact production `PairedFix`, `PairedNavState`, and `PairedView` interfaces in `src/types/protocol.ts`.
- Development-build configuration, native app assets, EAS profiles, tests, and CI.

**Production realtime pairing and native background GPS sharing are implemented.** The native app joins the existing Tesla broadcast channel, preserves the foreground heartbeat, and sends native GPS fixes using Supabase HTTP Broadcast. Set the existing project's public Supabase values to use it. Background GPS is **not yet proven on physical devices with the screen locked**; complete the acceptance procedure below before production rollout. No Tesla navigation engine, WebView, payments, microphone, search, navigation, or map-control implementation is included.

## Connect to the existing Tesla product

1. Copy `.env.example` to `.env`. Keep `EXPO_PUBLIC_DEMO_MODE=false`.
2. Set `EXPO_PUBLIC_SUPABASE_URL` to the **same HTTPS Supabase project URL used by the production Tesla app**, and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to that project's modern `sb_publishable_...` client key. No new Supabase project or database migration is needed. The adapter uses the existing public broadcast channel; it does not add a pairing endpoint or sign-in flow.
3. Restart Metro after changing environment values, install/open TMap Dev, and enter the six-character code shown by the Tesla browser.
4. The code is normalized to uppercase in memory. The channel is exactly `pair-${code.toLowerCase()}`; market selection does not change it. The UI stays in a subscribing state until Supabase reports `SUBSCRIBED`.
5. After subscription, the UI says **Realtime connected** and the phone immediately broadcasts `heartbeat` with `{ t: Date.now() }`, then repeats every 2000 ms. A subscription/server acknowledgement confirms Realtime delivery, not that a Tesla is actually listening. This protocol does not supply a separate peer-presence acknowledgement, so the UI makes no such claim.

Missing or invalid configuration displays a safe error instead of pretending to connect. No production values are checked into source. HTTPS URLs must not contain credentials, query parameters, or fragments. Only modern `sb_publishable_` keys are accepted; secret keys and legacy JWT/service-role keys are rejected.

### Disconnect, reconnect, and lifecycle

- Incoming `disconnect` with `{ by: "tesla" }` stops heartbeat/retry work, removes the channel, clears the in-memory session, returns to Connect, and shows **Disconnected by Tesla**. Invalid payloads and `{ by: "phone" }` echoes cannot trigger this path.
- Phone Disconnect first stops native location updates, clears the secure driving session and drains the bounded in-flight delivery. It then sends exactly `disconnect` / `{ by: "phone" }` on the subscribed socket, waiting at most 500 ms for acknowledgement before channel cleanup. Delivery cannot be guaranteed offline. A native stop/storage failure remains visible with a Stop/Settings retry; the app does not silently declare cleanup successful. Received Tesla disconnects also stop native sharing without echoing a phone disconnect.
- `CHANNEL_ERROR`, `TIMED_OUT`, or unexpected `CLOSED` immediately remove the ready state and stop heartbeat. The old dedicated channel/client is disposed before a replacement is created. Retries use 1, 2, 4, then 5-second delays, capped at 5 seconds; a successful subscription resets backoff and sends a fresh immediate heartbeat. Generation checks ignore late callbacks and prevent duplicate channels and timers.
- Without sharing, Step 2's **6-second stale / 20-second lost** behavior is unchanged. Inactive/background suspends the socket and heartbeat; a short foreground return resubscribes, while a longer absence returns to Connect.
- While native sharing is active, an old foreground heartbeat does **not** expire the local pairing session. HTTP fixes are the background transport. Foreground return opens one fresh WebSocket and resumes its immediate/2-second heartbeat. Stopping sharing restores the normal 20-second loss deadline. No JavaScript heartbeat timer is used as a background guarantee.
- UI unmount releases foreground socket/listener resources but does not stop an active native drive. Pairing is otherwise memory-only; only active sharing adds the minimal SecureStore record described below. Supabase Auth persistence, auto-refresh, and URL session detection remain disabled.

### Developer diagnostics

Development builds display the pairing code, channel state, last acknowledged heartbeat's send time, received broadcast count, and reconnect attempt count. The section is hidden in release JavaScript. It never displays Supabase keys, URLs, tokens, or raw server errors. The code and counters are cleared on disconnect. Non-disconnect inbound broadcasts are counted but not consumed by the placeholder navigation/map services.

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
    location.ts                  Observable permissions, native sharing and recovery
    locationBroadcast.ts         HTTP-only Supabase fix delivery (no subscription)
    voice.ts                     Destination recognition boundary
    navigation.ts                Requests/state for the existing navigation engine
    remoteMap.ts                 PairedView command boundary
    demo.ts                      Explicit in-memory demonstration adapters
    index.ts                     Adapter composition point
  location/                      Native adapter, exact fix conversion, SecureStore, telemetry
  background/registerTasks.ts    Module-scope task registration before Expo Router
  background/locationHandler.ts Headless newest-fix delivery with bounded pending work
tests/                           Protocol, lifecycle, configuration and UI tests
```

The connection controller is independent of React and tested with injected adapters. It handles duplicate submissions, bounded ordinary connection attempts, cancellation, late responses, channel failures, remote disconnects, and cleanup. It reports realtime-connected only from `SUBSCRIBED` diagnostics. Router guards preserve a visibly paused/reconnecting screen during interruptions. A restored native drive can reopen the Remote screen as reconnecting, but is never called realtime-connected before subscription.

### Protocol compatibility

`PairedFix`, `PairedNavState`, and `PairedView` preserve the supplied production fields, numeric types, nullable members, and mutable nested structures exactly. Native fixes use the original six-field payload. Unknown/invalid heading and speed remain null. The app does not consume route state or compute routes/reroutes.

The supported names remain `fix`, `nav`, `nav_clear`, `view`, `heartbeat`, and `disconnect`. `RemoteEvent` maps to Supabase's standard `{ type: "broadcast", event, payload }` API. Heartbeat is exactly `{ t: number }`; disconnect is exactly `{ by: "phone" | "tesla" }`. `nav_clear` remains opaque until that feature is implemented. Foreground broadcasts retain `ack: true`, `self: false`, public-channel settings and readiness guards. Native GPS deliberately uses `channel.httpSend('fix', fix)` without subscribing. No new event, database change, or Tesla engine change is introduced.

## Native background GPS (Step 3)

Rebuild the development client: this step adds `expo-location ~57.0.19`, `expo-task-manager ~57.0.19`, and `expo-secure-store ~57.0.4`, selected using Expo's SDK-compatible installer. For later SDK upgrades use `pnpm exec expo install expo-location expo-task-manager expo-secure-store`. App configuration uses the Location and SecureStore plugins/CNG; never hand-edit generated native folders. Expo Go is unsupported.

### Start, stop, and permissions

After live pairing, tap **Start Sharing Location**. Only this user action requests permission: foreground first, then background. Sharing is enabled only after both permissions and native startup succeed. Demo mode never starts GPS.

- **iOS:** grant When In Use, then **Always**, and enable Precise Location. After Allow Once, iOS may deny the subsequent Always request without a second prompt. Use **Open System App Settings → Location → Always**, then retry. The app surfaces denied/restricted/cannot-ask-again and reduced-accuracy states without pretending background permission was granted.
- **Android:** grant foreground location, then **Allow all the time** in the background permission/settings flow. A foreground location service displays “TMap · Sharing live driving location.” The explanation appears before the permission action. Approximate location is shown as a warning; enable precise access for navigation.
- Disabled location services, revoked permissions and failed startup have visible recovery messages. Foreground return rechecks running state and permissions. Stop Sharing Location and Disconnect cancel pending starts, suppress further sends, stop native updates and clear saved driving state. An in-flight network request cannot be recalled; cleanup waits for that bounded send before completing.

### Native callbacks and delivery

`index.ts` still imports task registration before Expo Router. `TaskManager.defineTask('tmap.background-location.v1', ...)` is at module scope; business logic lives in the separate headless handler, which needs no React context.

The task validates batch entries and selects the newest valid current fix. Latitude/longitude and accuracy must be finite/in range; accuracy must be non-negative. Heading outside `[0, 360)` and unknown/non-finite/negative speed become null. Native timestamps are preserved. Fixes older than 15 seconds or more than 1 second in the future are discarded; no old trail is replayed. This freshness check assumes the phone clock is reasonably accurate.

All native callbacks, in foreground and background, use the same explicit HTTP path: `pair-${code.toLowerCase()}`, event `fix`, exact `PairedFix`, public channel with `self: false`. The helper calls `httpSend()` with a 4-second request timeout and **never subscribes or opens a WebSocket**. Foreground realtime still sends its independent 2-second heartbeat. No extra heartbeat is sent for each fix because Tesla already counts fixes as activity.

The sender permits one request plus one replaceable newest pending fix. Failed or expired fixes are discarded, not persisted or retried as historical batches. A new native fix drives the next attempt. Supabase must support the installed SDK's `httpSend()` endpoint (Realtime server 2.97.0+); verify this against the existing production project. HTTP acknowledgement means server acceptance, not proof that Tesla received/rendered the position.

Native settings use BestForNavigation, AutomotiveNavigation, a 1 m movement threshold, Android's 1000 ms requested minimum interval, no deferred batching, no automatic iOS pausing, and the iOS background location indicator. This targets live navigation while minimized or locked; **OS scheduling controls actual delivery, so no exact 1 Hz rate is promised**. Sparse fixes, poor GPS reception, battery restrictions, or network loss can still exceed Tesla's 20-second activity window. If Tesla has discarded the session, stop/disconnect and pair again.

### Secure state, restart recovery, and privacy

Only while sharing is active, SecureStore holds `{ version: 1, code, market, startedAt }`. iOS uses `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` so a previously unlocked phone can read the session while locked, without biometric prompts. Public Supabase configuration stays in the app bundle, never in this record. No passwords, privileged keys, coordinates or location history are stored. Callback code never logs coordinates, pairing codes or credentials.

Startup checks native task registration and secure state. A valid saved session plus a running task restores sharing and reconnects foreground realtime. Saved state without a task is cleared. A task without valid saved state is stopped. Startup never starts tracking from an old code. UI remount does not terminate an active drive. Force-quit/OS termination may stop delivery; do not rely on automatic relaunch. Android manufacturer battery restrictions and recents-list behavior vary.

Normal UI shows sharing state, latest accuracy, fix age/time, and successful HTTP-send count for the current JavaScript process; it does not show coordinates. Counters are not durable and reset after process restart; latest measurements remain empty until a fresh callback arrives.

**Protocol limitation:** an outbound HTTP request cannot receive Tesla's transient `disconnect` broadcast while the foreground socket is suspended or offline. Every Tesla disconnect actually received by the app stops native sharing. A broadcast missed while backgrounded is not replayed on foreground return. Guaranteed remote stop in that situation requires a durable server-side revocation mechanism or another background-capable inbound channel; neither exists in the supplied protocol, and neither is invented here. Use the phone's Stop/Disconnect control to ensure sharing ends. This limitation must be resolved before any product promise of guaranteed background remote cancellation.

### Physical-device acceptance procedure — still required

Run on **both a physical iPhone and physical Android phone**, with new development builds and the existing production Supabase project. Use a passenger/tester or a controlled route; do not operate devices while driving. Record OS/build versions and observed timings without collecting a location trail in app logs.

1. Pair and verify SUBSCRIBED plus foreground heartbeat. Start sharing with precise foreground/background permissions. Check Tesla receives native `fix` events and follows the current position; verify accuracy, timestamps and successful-send count.
2. Drive with TMap foregrounded, minimize it for at least five minutes, then repeat with the screen locked for at least five minutes. Confirm Tesla keeps receiving fresh fixes, including across the 20-second boundary. Check Android notification/iOS indicator. Include stationary stops to detect gaps in OS delivery.
3. Return to foreground repeatedly. Confirm the same drive remains active, the socket reconnects, heartbeat resumes, and no duplicate channel, heartbeat timer, task or fix stream appears.
4. Disable/re-enable networking briefly and for over 20 seconds. Check failures do not crash the task, recovery sends current positions only, and explicitly verify whether Tesla needs re-pairing after its own expiry. No stale position replay should occur.
5. Test foreground denial, background denial, cannot-ask-again, iOS Allow Once followed by Always, reduced/approximate accuracy, disabled location services, and permission revocation during a drive. Verify Settings recovery and no false active state.
6. Stop sharing, then restart and use phone Disconnect. Confirm native indicator/service stops, saved state is cleared, no further fixes arrive after bounded in-flight cleanup, and Connect is shown. Test Tesla Disconnect while the foreground channel is listening. Separately verify/document the missed-background-disconnect limitation above.
7. Exercise restart cases A/B/C: active task + valid record; stale record without task; orphan task without valid record. Restore only case A, clear case B, stop case C. Verify no permission request or silent task start on launch. Include UI remount and rapid Start/Stop/Disconnect races.
8. Force-quit and relaunch, reboot/unlock, test Android battery saver/OEM restrictions, and test iPhone locked after first unlock. Record platform limitations; passing unit tests or JavaScript export is not proof of locked-screen execution.

## Quality checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm expo:check
pnpm expo:doctor
```

`pnpm check` runs typecheck, lint, and tests. CI repeats those checks on push/pull request. Tests retain Step 1/2 coverage and add permissions, exact fix conversion, newest-fix delivery, HTTP-only sending, secure-session lifecycle, task registration/settings, start/stop races, restart cases, disconnect ordering, and background/foreground recovery. SDK/native/network boundaries are mocked; no tests require production credentials. Run the physical acceptance procedure before making production background-GPS claims.

For a live acceptance check, use a physical development build and a real Tesla pairing code on the same Supabase project. Confirm Tesla receives heartbeats, test disconnect from each side, toggle networking briefly, then test an absence longer than 20 seconds. A passing mocked test suite does not establish a live Tesla connection.

Before shipping, additionally run a development build on real iOS/Android devices and check keyboard behavior, small screens, large system text, VoiceOver/TalkBack, and native navigation. JavaScript bundling and component tests do not substitute for native device validation.

## Reference documentation

- [Expo SDK 57 release and Xcode compatibility](https://expo.dev/changelog/sdk-57)
- [Expo Router installation and custom entry points](https://docs.expo.dev/router/installation/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS Build configuration](https://docs.expo.dev/build/eas-json/)
- [Expo Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/)
- [Expo TaskManager](https://docs.expo.dev/versions/v57.0.0/sdk/task-manager/)
- [Expo SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/)
- [Supabase React Native client setup](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- [Supabase broadcast and server acknowledgements](https://supabase.com/docs/guides/realtime/broadcast)
