<img src="assets/icon.svg" width="64" height="64" alt="">

# Press on White

A shared-screen browser reaction game for 2–4 people around one phone or tablet. First eligible press on white earns +1; pressing a color or blank costs −1. Blank false starts also make that player ineligible for the next color. After white disappears, pressing is wrong. Five rounds of 20 seconds; cumulative scores decide the winner, including shared wins and negative totals.

Setup offers Press on White and Circle among squares. A fresh load selects Press on White; choose Circle among squares to opt in. Its first eligible press on a board containing a circle earns +1; all squares or a blank gap costs −1. A blank false start locks that player out of the next board. Setup shows the selected mode's registered name and rules before readiness. Both modes use their existing default configurations; Circle among squares uses easy. There is no difficulty picker.

## Run

Requires Bun 1.3.14 or later and a current browser with Pointer Events. This project uses vanilla TypeScript bundled by Bun; no framework or ECS is required.

```sh
bun install --frozen-lockfile
bun run dev
bun run check
bun run test
bun run build
```

The development server prints its URL and listens on all interfaces at port 3000. In the dev script, `--host` has to follow `index.html`; Bun ignores that server flag when it comes first. If port 3000 is taken, Bun prints the next free port. `dist/` is the static production output. `bun run preview` serves that output on `http://127.0.0.1:4173`. Access the development server from a device on the same LAN to test physical multitouch. Fullscreen is optional; keyboard/controller gameplay input, persistence, offline installation, and sound are outside this foundation. Setup buttons support Tab and Enter/Space.

A successful CI run on `main` publishes `dist/` to GitHub Pages at `https://david0178418.github.io/4player-reaction/`. Built asset URLs are relative to `index.html`, so the same output works at `/` and under `/4player-reaction/`.

## Controls and flow

Seats use the same edges in portrait and landscape. Two players sit with Player 2 across the top and Player 1 across the bottom. Three players split the top between Player 3 (left) and Player 2 (right), with Player 1 across the bottom. Four players add Player 4 at bottom left and move Player 1 to bottom right. Top-seat labels rotate 180°. Center status and results face both edges; one shared stimulus stays in the middle. Round scores sit in each seat’s center margin. A scoring pad briefly fills green for +1 or red for −1; other pads stay neutral. The viewport gate requires at least 320 × 480 portrait or 560 × 320 landscape after additional device safe-area insets; DOM bounds at these minimums keep the ready screen between the controls. Physical comfort still needs device review. Each player presses their own seat to ready, then watches the central stimulus after 3/2/1. Release before pressing again. Holding never repeats and extra fingers cannot farm points. Everyone readies between rounds. Changing the mode in setup preserves the player count and creates a clean game. The chosen mode stays fixed for every round, including while paused. Rematch keeps the mode and roster and clears scores; Change setup returns to setup to choose either again.

Explicit pause, focus/visibility loss, orientation, or substantial viewport change covers the stimulus and freezes active time. Resume waits for layout stability, then requires everyone to ready and a new countdown. It always resumes into a blank gap. End match clears scores. Hidden time does not count toward a round.

## Boundaries

- `src/mode.ts` / `src/modes.ts`: validated configuration, roster, mode registry, Press on White rules, and deduplicated score reducer. A mode supplies create, advance, press, and a presentation value. It never owns the DOM, device listeners, or aggregate totals. The picker lists registered modes with a matching validated default configuration and reuses their names and rules. Adding an implemented mode registers its definition and typed defaults; the match runner and UI do not grow a branch per game.
- `src/game.ts`: match coordinator and active-time round runner. An injected clock and random source make timing reproducible. `frame()` commits stimulus changes; input evaluates the committed stimulus without advancing an unrendered schedule. The browser renders synchronously after input so a claimed white is cleared before another press.
- `src/input.ts`: pointer ownership, physical down/release tracking, gesture prevention, and teardown. Invalidation never turns a held pointer into a new press.
- `src/main.ts` / `src/style.css`: presentation, readiness controls, browser interruptions, viewport gating, and resource cleanup.

Default configuration in `src/mode.ts` uses independently equal white/red/blue/green probabilities, 250–500 ms blank gaps, and 700–1,400 ms appearances. Repeated colors are allowed. Configurations are copied and validated when a game is created. The default match stays Press on White. Circle among squares is selectable in setup with easy 3×3 boards held for 5 s. Its other draft configurations remain available in code: medium 4×4 for 3.5 s, hard 5×4 for 2.5 s, and insane 6×5 for 1.8 s. A true board hides one circle among squares of the same neutral color. The prompt is drawn upright and rotated.

## Acceptance

Tests establish deterministic rules and lifecycle behavior. Rendering, on-page pointer handling, physical four-touch tracking, reach, accidental OS gestures, visibility and orientation changes, back-forward-cache navigation, and safe-area comfort must be checked on actual phones and tablets and recorded with device, OS, and browser. Visual direction, white opportunity frequency, penalties, and pace/feel require owner review. Numeric defaults remain draft values until that review. Do not treat automated checks as physical-device or creative acceptance; track remaining acceptance in GitHub issue #7.
