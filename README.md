<img src="assets/icon.svg" width="64" height="64" alt="">

# Press on White

A shared-screen browser reaction game for 2–4 people around one phone or tablet. First eligible press on white earns +1; pressing a color or blank costs −1. Blank false starts also make that player ineligible for the next color. After white disappears, pressing is wrong. Five rounds of 20 seconds; cumulative scores decide the winner, including shared wins and negative totals.

## Run

Requires Bun 1.3.14 or later and a current browser with Pointer Events. This project uses vanilla TypeScript bundled by Bun; no framework or ECS is required.

```sh
bun install --frozen-lockfile
bun run dev
bun run check
bun run test
bun run build
```

The development server prints its URL and listens on all interfaces at port 3000. In the dev script, `--host` has to follow `index.html`; Bun ignores that server flag when it comes first. If port 3000 is taken, Bun prints the next free port. `dist/` is the static production output. `bun run preview` serves that output on `http://127.0.0.1:4173`. Access the development server from a device on the same LAN to test physical multitouch. Fullscreen is optional; keyboard/controller input, persistence, offline installation, sound, and other modes are outside this foundation.

A successful CI run on `main` publishes `dist/` to GitHub Pages at `https://david0178418.github.io/4player-reaction/`. Built asset URLs are relative to `index.html`, so the same output works at `/` and under `/4player-reaction/`.

## Controls and flow

Seats use the same edges in portrait and landscape. Two players sit with Player 2 across the top and Player 1 across the bottom. Three players split the top between Player 3 (left) and Player 2 (right), with Player 1 across the bottom. Four players add Player 4 at bottom left and move Player 1 to bottom right. Top-seat labels rotate 180°. Center status and results face both edges; one shared swatch stays in the middle. Round scores sit in each seat’s center margin. A scoring pad briefly fills green for +1 or red for −1; other pads stay neutral. The viewport gate requires at least 320 × 480 portrait or 560 × 320 landscape after additional device safe-area insets; DOM bounds at these minimums keep the ready screen between the controls. Physical comfort still needs device review. Each player presses their own seat to ready, then watches the central stimulus after 3/2/1. Release before pressing again. Holding never repeats and extra fingers cannot farm points. Everyone readies between rounds. Rematch keeps the roster and clears scores; Change players returns to setup.

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

Playwright builds and serves the production app on port 4173. Native browser journeys use the default five 20-second rounds and three-second countdowns for every roster. Controlled browser clocks cover interruption and input boundaries; lifecycle and multitouch events are dispatched synthetically. Layout checks capture setup, readiness, countdown, play, pause, round results, and match results for every roster at minimum, phone, and tablet portrait/landscape sizes, including simulated safe-area-adjusted minimums. Inadequate viewports still block starting. Screenshots and failure traces are written to `test-output/browser/` and uploaded by CI. Typechecking includes the browser suite. To use an already installed Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its executable path.

Actual operating-system visibility/focus changes, real back-forward-cache navigation, physical four-touch behavior, safe-area/system gesture comfort, and owner visual/pace acceptance remain device review. A merged implementation does not by itself establish these.

## Acceptance

Tests establish deterministic rules and lifecycle behavior. Synthetic browser interaction establishes rendering and adapter behavior only. Physical four-touch tracking, reach, accidental OS gestures, and visibility/orientation behavior must be checked on actual phones/tablets and recorded with device/OS/browser. Visual direction, white opportunity frequency, penalties, and pace/feel require owner review. Numeric defaults remain draft values until that review. Do not treat automated checks as physical-device or creative acceptance; track remaining acceptance in GitHub issue #7.
