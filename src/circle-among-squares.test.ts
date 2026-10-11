import {describe, expect, test} from 'bun:test';
import {Game} from './game';
import {CIRCLE_ACTIVITY_INTERVAL_MS, circleAmongSquares, circleDefaults, circlePrompt} from './circle-among-squares';
import {defaults, listModes, registerMode, requireMode, validateConfig, type CircleAmongSquaresConfig, type CircleStimulus, type Difficulty, type Stimulus} from './mode';
import {loadModes} from './modes';

const sequence = function(values: readonly number[]): () => number {
	let index = 0;
	return function() {
		const value = values[index];
		index += 1;
		if (value === undefined) throw new Error('Random sequence exhausted');
		return value;
	};
};
const asCircle = function(stimulus: Stimulus | null): CircleStimulus {
	if (stimulus === null || stimulus.mode !== 'circle-among-squares') throw new Error('Expected circle stimulus');
	return stimulus;
};
const claimOf = function(config: CircleAmongSquaresConfig, random: () => number): CircleStimulus {
	const opened = asCircle(circleAmongSquares.create(0, 1, config, sequence([0])));
	return asCircle(circleAmongSquares.advance(opened, opened.until, config, random));
};
const reveal = function(board: CircleStimulus, config: CircleAmongSquaresConfig): CircleStimulus {
	if (board.showing !== 'claim' || board.circleAppearsAt === null) throw new Error('Expected a scheduled circle');
	return asCircle(circleAmongSquares.advance(board, board.circleAppearsAt, config, function() { return 0; }));
};
const fixture = function(config: CircleAmongSquaresConfig, random: () => number) {
	let time = 0;
	const game = new Game(function() { return time; }, random, {rounds: 5, modes: [config]});
	return {game, advance: function(ms: number, frame = true) { time += ms; if (frame) game.frame(); }};
};
const begin = function(game: Game, advance: (ms: number) => void) {
	game.select(4); game.start();
	for (const player of game.state.players) game.press(player);
	advance(game.config.countdownMs);
};
describe('circle among squares', function() {
	test('registers beside Press on White with typed default configurations', function() {
		expect(loadModes()).toEqual(['press-on-white', 'circle-among-squares']);
		expect(listModes().map(function(mode) { return mode.id; })).toEqual(['press-on-white', 'circle-among-squares']);
		expect(() => registerMode(circleAmongSquares)).toThrow();
		expect(() => requireMode('missing-mode')).toThrow();
		expect(() => requireMode('press-on-white').validate(circleDefaults)).toThrow();
		expect(() => requireMode('circle-among-squares').validate(defaults)).toThrow();
		const selected = new Game(function() { return 0; }, function() { return 0; }, {rounds: 5, modes: [circleDefaults]});
		expect(selected.mode.id).toBe('circle-among-squares');
		expect(selected.mode.name).toBe('Circle among squares');
	});
	test('copies a valid config and rejects a broken match shell', function() {
		const config = validateConfig(circleDefaults);
		expect(config).toEqual(circleDefaults);
		expect(config.gap).not.toBe(circleDefaults.gap);
		expect(() => validateConfig({...circleDefaults, roundMs: 0})).toThrow();
		expect(() => validateConfig({...circleDefaults, gap: [0, 2]})).toThrow();
	});
	test('shows squares first, then reveals one circle in a random cell and keeps it visible', function() {
		const specs = [
			['easy', 3, 3, 5_000],
			['medium', 4, 4, 3_500],
			['hard', 5, 4, 2_500],
			['insane', 6, 5, 1_800],
		] as const;
		for (const [difficulty, columns, rows, hold] of specs) {
			const config = validateConfig({...circleDefaults, difficulty});
			if (config.mode !== 'circle-among-squares') throw new Error('Expected circle config');
			const board = claimOf(config, sequence([0, 0.99, 0.5]));
			if (board.showing !== 'claim') throw new Error('Expected a claim');
			expect(board.circleCell).toBe(columns * rows - 1);
			expect(board.circleRevealed).toBe(false);
			expect(board.circleAppearsAt).toBe(250 + hold / 2);
			expect(board.columns).toBe(columns);
			expect(board.rows).toBe(rows);
			expect(board.cells).toHaveLength(columns * rows);
			expect(board.until).toBe(250 + hold);
			expect(board.cells.every(function(cell) { return cell.shape === 'square'; })).toBe(true);
			expect(circleAmongSquares.present(board)).toEqual({kind: 'glyphs', prompt: circlePrompt, columns, rows, cells: board.cells});
			const shown = reveal(board, config);
			if (shown.showing !== 'claim') throw new Error('Expected the revealed claim');
			expect(shown.circleRevealed).toBe(true);
			expect(shown.cells.filter(function(cell) { return cell.shape === 'circle'; })).toHaveLength(1);
			expect(shown.cells[columns * rows - 1]?.shape).toBe('circle');
			expect(circleAmongSquares.present(shown)).toEqual({kind: 'glyphs', prompt: circlePrompt, columns, rows, cells: shown.cells});
			const held = asCircle(circleAmongSquares.advance(shown, shown.until - 1, config, function() { throw new Error('An active board should not draw randomness'); }));
			if (held.showing !== 'claim') throw new Error('Expected the board to remain active');
			expect(held.circleRevealed).toBe(true);
			expect(held.cells.filter(function(cell) { return cell.shape === 'circle'; })).toHaveLength(1);
		}
		const hidden = claimOf(circleDefaults, sequence([0.5]));
		if (hidden.showing !== 'claim') throw new Error('Expected a false claim');
		expect(hidden.circleCell).toBeNull();
		expect(hidden.circleAppearsAt).toBeNull();
		expect(hidden.cells.every(function(cell) { return cell.shape === 'square'; })).toBe(true);
		expect(circleAmongSquares.present(asCircle(circleAmongSquares.create(0, 1, circleDefaults, sequence([0]))))).toEqual({kind: 'blank', prompt: circlePrompt});
		const almost = claimOf({...circleDefaults, difficulty: 'medium' satisfies Difficulty}, sequence([0.499, 0, 0.5]));
		if (almost.showing !== 'claim') throw new Error('Expected a true claim');
		expect(almost.circleCell).toBe(0);
		expect(almost.cells[0]?.shape).toBe('square');
		const almostShown = reveal(almost, {...circleDefaults, difficulty: 'medium'});
		if (almostShown.showing !== 'claim') throw new Error('Expected the revealed claim');
		expect(almostShown.cells[0]?.shape).toBe('circle');
	});
	test('changes colors and tile details on clock phases without leaking the hidden target', function() {
		const trueBoard = claimOf(circleDefaults, sequence([0, 0.99, 0.61]));
		const falseBoard = claimOf(circleDefaults, sequence([0.5]));
		if (trueBoard.showing !== 'claim' || falseBoard.showing !== 'claim') throw new Error('Expected active boards');
		const visualCells = function(board: CircleStimulus) {
			if (board.showing !== 'claim') throw new Error('Expected an active board');
			return board.cells.map(function(cell) { return {color: cell.color, detail: cell.detail}; });
		};
		const firstColors = trueBoard.cells.map(function(cell) { return cell.color; });
		const firstDetails = trueBoard.cells.map(function(cell) { return cell.detail; });
		expect(visualCells(trueBoard)).toEqual(visualCells(falseBoard));
		expect(trueBoard.cells.every(function(cell) { return cell.shape === 'square'; })).toBe(true);

		const changedTime = trueBoard.activityStartedAt + CIRCLE_ACTIVITY_INTERVAL_MS;
		const changedTrue = asCircle(circleAmongSquares.advance(trueBoard, changedTime, circleDefaults, function() { throw new Error('An active board should not draw randomness'); }));
		const changedFalse = asCircle(circleAmongSquares.advance(falseBoard, changedTime, circleDefaults, function() { throw new Error('An active board should not draw randomness'); }));
		if (changedTrue.showing !== 'claim' || changedFalse.showing !== 'claim') throw new Error('Expected active boards');
		expect(changedTrue.activityPhase).toBe(1);
		expect(changedTrue.cells.map(function(cell) { return cell.color; })).not.toEqual(firstColors);
		expect(changedTrue.cells.map(function(cell) { return cell.detail; })).not.toEqual(firstDetails);
		expect(visualCells(changedTrue)).toEqual(visualCells(changedFalse));
		expect(changedFalse.cells.every(function(cell) { return cell.shape === 'square'; })).toBe(true);

		if (trueBoard.circleCell === null || trueBoard.circleAppearsAt === null) throw new Error('Expected a scheduled circle');
		const beforeReveal = asCircle(circleAmongSquares.advance(trueBoard, trueBoard.circleAppearsAt - 1, circleDefaults, function() { throw new Error('An active board should not draw randomness'); }));
		const revealed = asCircle(circleAmongSquares.advance(beforeReveal, trueBoard.circleAppearsAt, circleDefaults, function() { throw new Error('An active board should not draw randomness'); }));
		if (beforeReveal.showing !== 'claim' || revealed.showing !== 'claim') throw new Error('Expected active boards');
		const targetBefore = beforeReveal.cells[trueBoard.circleCell];
		const targetAfter = revealed.cells[trueBoard.circleCell];
		expect(targetBefore?.shape).toBe('square');
		expect(targetAfter?.shape).toBe('circle');
		expect(targetAfter?.color).toBe(targetBefore?.color);
		expect(targetAfter?.detail).toBe(targetBefore?.detail);

		const afterReveal = asCircle(circleAmongSquares.advance(revealed, revealed.activityStartedAt + (revealed.activityPhase + 1) * CIRCLE_ACTIVITY_INTERVAL_MS, circleDefaults, function() { throw new Error('An active board should not draw randomness'); }));
		if (afterReveal.showing !== 'claim') throw new Error('Expected the revealed board to remain active');
		expect(afterReveal.circleRevealed).toBe(true);
		expect(afterReveal.cells.filter(function(cell) { return cell.shape === 'circle'; })).toHaveLength(1);
		expect(afterReveal.cells[trueBoard.circleCell]?.color).not.toBe(targetAfter?.color);
		const activeFalse = asCircle(circleAmongSquares.advance(falseBoard, falseBoard.until - 1, circleDefaults, function() { throw new Error('An active board should not draw randomness'); }));
		if (activeFalse.showing !== 'claim') throw new Error('Expected an active false board');
		expect(activeFalse.cells.every(function(cell) { return cell.shape === 'square'; })).toBe(true);
	});
	test('scores a true board once, keeps a false board up, and lets the next player answer', function() {
		const {game, advance} = fixture(circleDefaults, sequence([0, 0, 0, 0.5, 0.5, 0]));
		begin(game, advance);
		advance(250);
		const hiddenCircle = asCircle(game.state.stimulus);
		if (hiddenCircle.showing !== 'claim') throw new Error('Expected a true claim');
		expect(hiddenCircle.circleRevealed).toBe(false);
		game.press(1);
		expect(game.state.scores.total[1]).toBe(-1);
		advance(2_500);
		const trueBoard = asCircle(game.state.stimulus);
		if (trueBoard.showing !== 'claim') throw new Error('Expected the revealed true claim');
		expect(trueBoard.circleRevealed).toBe(true);
		game.press(1);
		game.press(2);
		expect(game.state.scores.total[2]).toBe(1);
		expect(asCircle(game.state.stimulus).showing).toBe('gap');
		const missed = fixture(circleDefaults, sequence([0, 0.5, 0]));
		begin(missed.game, missed.advance);
		missed.advance(250);
		const falseBoard = asCircle(missed.game.state.stimulus);
		missed.game.press(1); missed.game.press(1);
		expect(missed.game.state.scores.total[1]).toBe(-1);
		expect(asCircle(missed.game.state.stimulus).id).toBe(falseBoard.id);
		missed.game.press(2);
		expect(missed.game.state.scores.total[2]).toBe(-1);
		expect(missed.game.state.scores.total[1]).toBe(-1);
		missed.advance(5_000);
		expect(missed.game.state.scores.total).toEqual({1: -1, 2: -1, 3: 0, 4: 0});
		expect(asCircle(missed.game.state.stimulus).showing).toBe('gap');
	});
	test('a gap false start locks that player out while another player can still score', function() {
		const {game, advance} = fixture(circleDefaults, sequence([0, 0, 0, 0, 0]));
		begin(game, advance);
		advance(100, false);
		game.press(1);
		expect(game.state.scores.total[1]).toBe(-1);
		expect(asCircle(game.state.stimulus).showing).toBe('gap');
		advance(150);
		const board = asCircle(game.state.stimulus);
		if (board.showing !== 'claim') throw new Error('Expected the next board');
		expect(board.circleRevealed).toBe(true);
		expect(board.blocked).toEqual([1]);
		game.press(1);
		expect(game.state.scores.total[1]).toBe(-1);
		game.press(2);
		expect(game.state.scores.total[2]).toBe(1);
		expect(game.state.scores.total[1]).toBe(-1);
	});
	test('a press at the round deadline does not score', function() {
		const {game, advance} = fixture({...circleDefaults, roundMs: 1_000}, sequence([0, 0, 0, 0]));
		begin(game, advance);
		advance(250);
		advance(750, false);
		game.press(1);
		expect(game.state.phase).toBe('round-results');
		expect(game.state.scores.total[1]).toBe(0);
	});
	test('pause resumes into a fresh gap and keeps the score', function() {
		const {game, advance} = fixture(circleDefaults, sequence([0, 0, 0, 0, 0, 0]));
		begin(game, advance);
		advance(250);
		game.press(4);
		const remaining = game.state.remaining;
		game.pause('hidden');
		advance(60_000, false);
		game.resume();
		for (const player of game.state.players) game.press(player);
		advance(3_000);
		expect(game.state.phase).toBe('playing');
		expect(asCircle(game.state.stimulus).showing).toBe('gap');
		expect(game.state.remaining).toBe(remaining);
		expect(game.state.scores.total[4]).toBe(1);
	});
});
