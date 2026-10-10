<img src="assets/icon.svg" width="64" height="64" alt="">

# Press on White

A shared-screen browser reaction game for 2–4 people around one phone or tablet. Ten rounds of 20 seconds by default; cumulative scores decide the winner, including shared wins and negative totals. Each round randomly draws from the playable modes that have not appeared in the current cycle. After every mode has appeared, the full pool becomes eligible again. Cycle boundaries can repeat the last mode of the preceding cycle. Five modes over fifteen rounds would produce three complete cycles, each in a random order.

Setup only asks for the player count. Press on White and Circle among squares participate automatically, using their registered default configurations; Circle among squares uses easy. The selected mode's name and scoring objective appear during readiness and the countdown. In Press on White, the first eligible press on white earns +1; colors or blank cost −1. In Circle among squares, the first eligible press on a board containing a circle earns +1; all squares or blank cost −1. A blank false start locks that player out of the next target. There is no mode, round-count, or difficulty picker. Set the round count in code with `DEFAULT_ROUNDS` in `src/game.ts`, or pass a positive integer in `MatchConfig.rounds` when creating a game.

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

Seats use the same edges in portrait and landscape. Two players sit with Player 2 across the top and Player 1 across the bottom. Three players split the top between Player 3 (left) and Player 2 (right), with Player 1 across the bottom. Four players add Player 4 at bottom left and move Player 1 to bottom right. Top-seat labels rotate 180°. Center status and results face both edges; one shared stimulus stays in the middle. Round scores sit in each seat’s center margin. A scoring pad briefly fills green for +1 or red for −1; other pads stay neutral. The viewport gate requires at least 320 × 480 portrait or 560 × 320 landscape after additional device safe-area insets; DOM bounds at these minimums keep the ready screen between the controls. Physical comfort still needs device review. Each player presses their own seat to ready, then watches the central stimulus after 3/2/1. Release before pressing again. Holding never repeats and extra fingers cannot farm points. Everyone readies between rounds. The next mode is drawn when everyone is ready and appears during the countdown. Pausing retains the current round's mode. Rematch keeps the roster and match settings, clears scores, and starts a fresh cycle; Change setup returns to player-count selection and clears the cycle history.

Explicit pause, focus/visibility loss, orientation, or substantial viewport change covers the stimulus and freezes active time. Resume waits for layout stability, then requires everyone to ready and a new countdown. It always resumes into a blank gap. End match clears scores. Hidden time does not count toward a round.

## Boundaries

- `src/mode.ts` / `src/modes.ts`: validated configuration, roster, mode registry, random draws without replacement, Press on White rules, and deduplicated score reducer. A mode supplies create, advance, press, and a presentation value. It never owns the DOM, device listeners, or aggregate totals. Registered modes with matching validated defaults enter the pool automatically. Adding an implemented mode registers its definition and typed defaults; the match runner and UI do not grow a branch per game.
- `src/game.ts`: match configuration, cycle history, match coordinator, and active-time round runner. The match owns the round count; each mode owns its round timing and stimulus configuration. An injected clock and random source make timing reproducible. `frame()` commits stimulus changes; input evaluates the committed stimulus without advancing an unrendered schedule. The browser renders synchronously after input so a claimed white is cleared before another press.
- `src/input.ts`: pointer ownership, physical down/release tracking, gesture prevention, and teardown. Invalidation never turns a held pointer into a new press.
- `src/main.ts` / `src/style.css`: presentation, readiness controls, browser interruptions, viewport gating, and resource cleanup.

Default configuration in `src/mode.ts` uses independently equal white/red/blue/green probabilities, 250–500 ms blank gaps, and 700–1,400 ms appearances. Repeated colors are allowed. Configurations are copied and validated when a game is created. Circle among squares uses easy 3×3 boards held for 5 s. Its other draft configurations remain available in code: medium 4×4 for 3.5 s, hard 5×4 for 2.5 s, and insane 6×5 for 1.8 s. A true board hides one circle among squares of the same neutral color. The prompt is drawn upright and rotated.

## Acceptance

Tests establish deterministic rules and lifecycle behavior. Rendering, on-page pointer handling, physical four-touch tracking, reach, accidental OS gestures, visibility and orientation changes, back-forward-cache navigation, and safe-area comfort must be checked on actual phones and tablets and recorded with device, OS, and browser. Visual direction, white opportunity frequency, penalties, and pace/feel require owner review. Numeric defaults remain draft values until that review. Do not treat automated checks as physical-device or creative acceptance; track remaining acceptance in GitHub issue #7.
