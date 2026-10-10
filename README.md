<img src="assets/icon.svg" width="64" height="64" alt="">

# Press on White

A shared-screen browser reaction game for 2–4 people around one phone or tablet. First eligible press on white earns +1; pressing a color or blank costs −1. Blank false starts also make that player ineligible for the next color. After white disappears, pressing is wrong. Five rounds of 20 seconds; cumulative scores decide the winner, including shared wins and negative totals.

## Run

Requires Bun 1.3.14 or later and a current browser with Pointer Events. This project uses vanilla TypeScript and Vite; no framework, ECS, or service is required.

```sh
bun install --frozen-lockfile
bun run dev
bun run check
bun run test
bun run build
```

The development URL is printed by Vite. `dist/` is the static production output. Access the development server from a device on the same LAN to test physical multitouch. Fullscreen is optional; keyboard/controller input, persistence, offline installation, sound, and other modes are outside this foundation.

A successful CI run on `main` publishes `dist/` to GitHub Pages at `https://david0178418.github.io/4player-reaction/`. That build sets `BASE_PATH` so asset URLs include `/4player-reaction/`. Local development, unit tests, and Playwright leave the base at `/`.

## Controls and flow

Corners stay fixed: P1 top left, P2 top right, P3 bottom right, P4 bottom left. Two players use P1/P3; three add P2. Upper labels face the top edge. The viewport gate requires at least 320 × 480 portrait or 560 × 320 landscape after additional device safe-area insets; DOM bounds at these minimums keep the ready screen between the controls. Physical comfort still needs device review. Each player presses their own corner to ready, then watches the central stimulus after 3/2/1. Release before pressing again. Holding never repeats and extra fingers cannot farm points. Everyone readies between rounds. Rematch keeps the roster and clears scores; Change players returns to setup.

Explicit pause, focus/visibility loss, orientation, or substantial viewport change covers the stimulus and freezes active time. Resume waits for layout stability, then requires everyone to ready and a new countdown. It always resumes into a blank gap. End match clears scores. Hidden time does not count toward a round.

## Boundaries

- `src/mode.ts`: validated configuration, roster, mode contract, Press on White rules, and deduplicated score reducer. Modes produce structured outcomes and never own the DOM, device listeners, or aggregate totals.
- `src/game.ts`: match coordinator and active-time round runner. An injected clock and random source make timing reproducible. `frame()` commits stimulus changes; input evaluates the committed stimulus without advancing an unrendered schedule. The browser renders synchronously after input so a claimed white is cleared before another press.
- `src/input.ts`: pointer ownership, physical down/release tracking, gesture prevention, and teardown. Invalidation never turns a held pointer into a new press.
- `src/main.ts` / `src/style.css`: presentation, readiness controls, browser interruptions, viewport gating, and resource cleanup.

Default configuration in `src/mode.ts` uses independently equal white/red/blue/green probabilities, 250–500 ms blank gaps, and 700–1,400 ms appearances. Repeated colors are allowed. Configurations are copied and validated when a game is created. A future mode can implement `ModeDefinition` and supply presentation while retaining input, lifecycle, and score reduction; no second mode is included.

## Browser checks

```sh
bunx playwright install chromium
bun run test:browser
```

Playwright builds and serves the production app on port 4173. Native browser journeys use the default five 20-second rounds and three-second countdowns for every roster. Controlled browser clocks cover interruption and input boundaries; lifecycle and multitouch events are dispatched synthetically. Layout checks capture setup, readiness, countdown, play, pause, round results, match results, and inadequate viewports for phone/tablet portrait and landscape sizes. Screenshots and failure traces are written to `test-output/browser/` and uploaded by CI. Typechecking includes the browser suite. To use an already installed Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its executable path.

Actual operating-system visibility/focus changes, real back-forward-cache navigation, physical four-touch behavior, safe-area/system gesture comfort, and owner visual/pace acceptance remain device review. A merged implementation does not by itself establish these.

## Acceptance

Tests establish deterministic rules and lifecycle behavior. Synthetic browser interaction establishes rendering and adapter behavior only. Physical four-touch tracking, reach, accidental OS gestures, and visibility/orientation behavior must be checked on actual phones/tablets and recorded with device/OS/browser. Visual direction, white opportunity frequency, penalties, and pace/feel require owner review. Numeric defaults remain draft values until that review. Do not treat automated checks as physical-device or creative acceptance; track remaining acceptance in GitHub issue #7.
