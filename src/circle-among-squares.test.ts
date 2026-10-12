import {describe, expect, test} from 'bun:test';
import {Game} from './game';
import {circleAmongSquares, circleDefaults, circlePrompt} from './circle-among-squares';
import {defaults, listModes, registerMode, requireMode, validateConfig, type CircleAmongSquaresConfig, type CircleStimulus, type Stimulus} from './mode';
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
	if (board.showing !== 'claim') throw new Error('Expected a scheduled circle');
	return asCircle(circleAmongSquares.advance(board, board.until, config, sequence([0.99, 0.5])));
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
	test('keeps every difficulty board fixed while circles repeatedly appear and expire', function() {
		const specs = [['easy', 3, 3, 5_000], ['medium', 4, 4, 3_500], ['hard', 5, 4, 2_500], ['insane', 6, 5, 1_800]] as const;
		for (const [difficulty, columns, rows, wait] of specs) {
			const config = {...circleDefaults, difficulty};
			const board = claimOf(config, sequence([0, 0.5]));
			if (board.showing !== 'claim') throw new Error('Expected a board');
			expect(board.columns).toBe(columns);
			expect(board.rows).toBe(rows);
			expect(board.until).toBe(250 + 250 + (wait - 250) / 2);
			expect(board.cells.every(function(cell) { return cell.shape === 'square'; })).toBe(true);
			const noRandom = function(): number { throw new Error('No transition expected'); };
			expect(circleAmongSquares.advance(board, board.until - 1, config, noRandom)).toBe(board);
			const shown = reveal(board, config);
			if (shown.showing !== 'claim') throw new Error('Expected a circle');
			expect(shown.circleCell).toBe(columns * rows - 1);
			expect(shown.until - board.until).toBe(1_000);
			expect(shown.cells.filter(function(cell) { return cell.shape === 'circle'; })).toHaveLength(1);
			expect(circleAmongSquares.advance(shown, shown.until - 1, config, noRandom)).toBe(shown);
			const hidden = asCircle(circleAmongSquares.advance(shown, shown.until, config, sequence([0])));
			if (hidden.showing !== 'claim') throw new Error('Expected the same board');
			expect(hidden.circleRevealed).toBe(false);
			expect(hidden.cells).toEqual(board.cells);
			expect(hidden.until).toBe(shown.until + 250);
			const returned = asCircle(circleAmongSquares.advance(hidden, hidden.until, config, sequence([0, 0])));
			if (returned.showing !== 'claim') throw new Error('Expected another circle');
			expect(returned.cells[0]?.shape).toBe('circle');
			expect(returned.until - hidden.until).toBe(500);
			for (const [index, cell] of returned.cells.entries()) {
				const original = board.cells[index];
				const previous = hidden.cells[index];
				if (original === undefined || previous === undefined) throw new Error('Missing cell');
				expect(cell.color).toBe(original.color);
				expect(cell.detail).toBe(original.detail);
				if (index !== 0) expect(cell).toBe(previous);
			}
			expect(circleAmongSquares.present(returned)).toEqual({kind: 'glyphs', prompt: circlePrompt, columns, rows, cells: returned.cells});
		}
	});
	test('samples visibility near the upper bound and gives a full window after a late frame', function() {
		const board = claimOf(circleDefaults, sequence([0, 0]));
		const shown = asCircle(circleAmongSquares.advance(board, board.until + 10_000, circleDefaults, sequence([0, 0.999])));
		expect(shown.until).toBe(board.until + 10_000 + 1_499);
	});
	test('scores once, penalizes wrong presses once per opportunity, and unlocks the next opportunity', function() {
		const {game, advance} = fixture(circleDefaults, function() { return 0; });
		begin(game, advance);
		advance(250);
		const hidden = asCircle(game.state.stimulus);
		game.press(1); game.press(1);
		expect(game.state.scores.total[1]).toBe(-1);
		expect(asCircle(game.state.stimulus).id).toBe(hidden.id);
		advance(250);
		game.press(1);
		expect(game.state.scores.total[1]).toBe(-1);
		advance(500);
		const expired = asCircle(game.state.stimulus);
		if (expired.showing !== 'claim') throw new Error('Expected the board to persist');
		expect(expired.cells).toEqual(hidden.showing === 'claim' ? hidden.cells : []);
		advance(250);
		game.press(1); game.press(2);
		expect(game.state.scores.total[1]).toBe(0);
		expect(game.state.scores.total[2]).toBe(-1);
		expect(asCircle(game.state.stimulus).showing).toBe('gap');
	});
	test('presses use the committed circle until a frame hides it and miss after disappearance', function() {
		const {game, advance} = fixture(circleDefaults, function() { return 0; });
		begin(game, advance); advance(250); advance(250);
		advance(500);
		game.press(2);
		expect(game.state.scores.total[2]).toBe(-1);
		advance(250);
		advance(500, false);
		game.press(1);
		expect(game.state.scores.total[1]).toBe(1);
	});
	test('a gap false start locks that player out while another player can still score', function() {
		const {game, advance} = fixture(circleDefaults, function() { return 0; });
		begin(game, advance);
		advance(100, false);
		game.press(1);
		expect(game.state.scores.total[1]).toBe(-1);
		expect(asCircle(game.state.stimulus).showing).toBe('gap');
		advance(150);
		advance(250);
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
		const {game, advance} = fixture(circleDefaults, function() { return 0; });
		begin(game, advance);
		advance(250);
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
