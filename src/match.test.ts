import {describe, expect, test} from 'bun:test';
import {circleAmongSquares, circleDefaults} from './circle-among-squares';
import {DEFAULT_ROUNDS, Game, type MatchConfig} from './game';
import {defaults, emptyScores, registerMode, requireMode} from './mode';
import {defaultConfigFor, drawMode, listPlayableModes} from './modes';

const fixture = function(rounds = DEFAULT_ROUNDS, random: () => number = function() { return 0; }) {
	let time = 0;
	const game = new Game(function() { return time; }, random, {rounds, modes: [defaults, circleDefaults]});
	return {game, advance: function(ms: number) { time += ms; game.frame(); }};
};
const ready = function(game: Game): void {
	for (const player of game.state.players) game.press(player);
};
const advanceUntilCircleVisible = function(game: Game, advance: (ms: number) => void): void {
	const config = game.config;
	if (config.mode !== 'circle-among-squares') return;
	for (let elapsed = 0; elapsed < 10_000; elapsed += 100) {
		const state = game.state.stimulus;
		if (state?.mode === 'circle-among-squares') {
			const probe = circleAmongSquares.press({...state, blocked: []}, {player: 1, time: 0}, config, function() { return 0; });
			if (probe?.delta === 1) return;
		}
		advance(100);
	}
	throw new Error('Expected the moving circle to become visible');
};

describe('random mode cycles', function() {
	test('five modes in fifteen draws produce three complete random cycles', function() {
		const modes = ['a', 'b', 'c', 'd', 'e'];
		const values = [0, 0, 0, 0, 0.99, 0.99, 0.99, 0.99, 0.4, 0.9, 0, 0.6];
		let index = 0;
		let remaining: readonly string[] = [];
		const played: string[] = [];
		for (let round = 0; round < 15; round += 1) {
			const selection = drawMode(modes, remaining, function() {
				const value = values[index++];
				if (value === undefined) throw new Error('Random sequence exhausted');
				return value;
			});
			played.push(selection.mode);
			remaining = selection.remaining;
		}
		expect(played.slice(0, 5)).toEqual(['a', 'b', 'c', 'd', 'e']);
		expect(played.slice(5, 10)).toEqual(['e', 'd', 'c', 'b', 'a']);
		expect(played.slice(10)).toEqual(['c', 'e', 'a', 'd', 'b']);
		for (let start = 0; start < 15; start += 5) expect([...played.slice(start, start + 5)].sort()).toEqual(modes);
		expect(modes).toEqual(['a', 'b', 'c', 'd', 'e']);
		expect(remaining).toEqual([]);
	});

	test('rejects empty pools and invalid random samples', function() {
		expect(() => drawMode([], [], function() { return 0; })).toThrow('No playable modes');
		for (const value of [-1, 1, NaN, Infinity]) {
			expect(() => drawMode(['a', 'b'], [], function() { return value; })).toThrow('Random value must be in [0, 1)');
		}
	});
});

describe('mixed matches', function() {
	test('a full registry cycle reaches every challenge before repeating a mode', function() {
		let time = 0;
		const configs = listPlayableModes().map(function(mode) { return defaultConfigFor(mode.id); });
		const game = new Game(function() { return time; }, function() { return 0.37; }, {rounds: configs.length, modes: configs});
		const played: string[] = [];
		game.start();
		for (let round = 0; round < game.match.modes.length; round += 1) {
			ready(game);
			time += game.config.countdownMs;
			game.frame();
			played.push(game.mode.id);
			expect(game.state.stimulus?.mode).toBe(game.config.mode);
			time += 500;
			game.frame();
			expect(game.state.stimulus?.mode).toBe(game.config.mode);
			time += game.config.roundMs;
			game.frame();
		}
		expect([...played].sort()).toEqual(game.match.modes.map(function(config) { return config.mode; }).sort());
		expect(new Set(played).size).toBe(game.match.modes.length);
	});

	test('includes all playable registered defaults and defaults to ten rounds', function() {
		const modes = listPlayableModes();
		expect(modes.map(function(mode) { return mode.id; }).sort()).toEqual(['press-on-white', 'circle-among-squares', 'color-word', 'true-equation', 'three-of-a-kind', 'five-different', 'matching-pair', 'mouse-to-cheese', 'countdown-to-zero', 'colliding-shapes', 'corner-to-corner', 'matching-capital', 'matching-flag', 'larger-population', 'larger-land-area', 'animal-silhouette', 'flying-silhouette', 'made-by-people', 'panda-in-group', 'sad-face', 'shape-count', 'equal-arrows', 'equal-t', 'equal-track-bars', 'four-in-a-line', 'alphabet-order', 'three-in-a-row', 'plus-and-minus'].sort());
		for (const config of [defaults, circleDefaults]) {
			const selected = defaultConfigFor(config.mode);
			expect(selected).toEqual(config);
			expect(selected.gap).not.toBe(config.gap);
		}
		expect(() => defaultConfigFor('catalog-only')).toThrow('Unknown mode');
		expect(() => registerMode({...requireMode('press-on-white'), id: 'catalog-only', defaults: circleDefaults})).toThrow('Mode does not match default configuration');
		const game = new Game(function() { return 0; }, function() { return 0.99; });
		expect(game.match.rounds).toBe(10);
		expect(game.match.modes).toEqual(modes.map(function(mode) { return defaultConfigFor(mode.id); }));
		game.start();
		const lastMode = modes.at(-1);
		if (lastMode === undefined) throw new Error('Expected registered modes');
		expect(game.mode.id).toBe(lastMode.id);
		expect(game.config).toEqual(defaultConfigFor(lastMode.id));
	});

	test('rejects invalid match settings and copies caller configurations', function() {
		const create = function(config: MatchConfig): Game { return new Game(function() { return 0; }, function() { return 0; }, config); };
		for (const rounds of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
			expect(() => create({rounds, modes: [defaults]})).toThrow('Invalid round count');
		}
		expect(() => create({rounds: 1, modes: []})).toThrow('No playable modes');
		expect(() => create({rounds: 1, modes: [defaults, defaults]})).toThrow('Duplicate match mode');
		expect(() => create({rounds: 1, modes: [{...defaults, roundMs: 0}]})).toThrow();
		const config = {rounds: 1, modes: [defaults]};
		const game = create(config);
		config.rounds = 99; config.modes.length = 0;
		expect(game.match.rounds).toBe(1);
		expect(game.match.modes).toEqual([defaults]);
		expect(game.config.gap).not.toBe(defaults.gap);
	});

	test('arbitrary lengths and all rosters cycle modes, retain totals, and finish at the configured round', function() {
		for (const count of [2, 3, 4]) {
			for (const rounds of [1, 3, 10, 15]) {
				const {game, advance} = fixture(rounds);
				game.select(count); game.start();
				for (let round = 1; round <= rounds; round += 1) {
					ready(game);
					expect(game.state.round).toBe(round);
					expect(game.mode.id).toBe(round % 2 === 1 ? 'press-on-white' : 'circle-among-squares');
					expect(game.config).toEqual(defaultConfigFor(game.mode.id));
					expect(game.state.scores.round[1]).toBe(0);
					advance(game.config.countdownMs);
					expect(game.state.stimulus?.mode).toBe(game.config.mode);
					expect(game.state.stimulus?.blocked).toEqual([]);
					advance(250);
					if (game.config.mode === 'circle-among-squares') advance(250);
					advanceUntilCircleVisible(game, advance);
					game.press(1);
					expect(game.state.scores.total[1]).toBe(round);
					advance(game.config.roundMs);
					expect(game.state.phase).toBe(round === rounds ? 'match-results' : 'round-results');
				}
			}
		}
	});

	test('each mode uses its own round and countdown timing', function() {
		let time = 0;
		const game = new Game(function() { return time; }, function() { return 0; }, {
			rounds: 2, modes: [{...defaults, roundMs: 500, countdownMs: 100}, {...circleDefaults, roundMs: 800, countdownMs: 200}],
		});
		const advance = function(ms: number): void { time += ms; game.frame(); };
		game.start(); ready(game); advance(100); advance(500);
		expect(game.state.phase).toBe('round-results');
		ready(game);
		expect(game.state.remaining).toBe(800);
		advance(199); expect(game.state.phase).toBe('countdown');
		advance(1); expect(game.state.phase).toBe('playing');
		advance(799); expect(game.state.phase).toBe('playing');
		advance(1); expect(game.state.phase).toBe('match-results');
	});

	test('interruptions never redraw the current round or skip a mode during results readiness', function() {
		const {game, advance} = fixture(3);
		game.start();
		const unchanged = function(): void {
			const config = game.config;
			const round = game.state.round;
			game.pause('interrupted'); advance(60_000); game.resume();
			expect(game.config).toBe(config);
			expect(game.state.round).toBe(round);
		};
		unchanged(); ready(game); unchanged(); ready(game); advance(game.config.countdownMs);
		advance(250); game.press(1); unchanged(); ready(game); advance(game.config.countdownMs);
		expect(game.state.scores.total[1]).toBe(1);
		advance(game.config.roundMs);
		game.press(1); unchanged();
		expect(game.state.phase).toBe('round-results');
		ready(game);
		expect(game.state.round).toBe(2);
		expect(game.mode.id).toBe('circle-among-squares');
		unchanged(); ready(game); advance(game.config.countdownMs); advance(game.config.roundMs); ready(game);
		expect(game.state.round).toBe(3);
		expect(game.mode.id).toBe('press-on-white');
	});

	test('rematches and ending early clear history and scores while preserving roster and settings', function() {
		for (const count of [2, 3, 4]) {
			const {game, advance} = fixture(3);
			game.select(count); game.start();
			for (let round = 1; round <= 3; round += 1) {
				ready(game); advance(game.config.countdownMs); advance(250);
				if (game.config.mode === 'circle-among-squares') advance(250);
				game.press(1); advance(game.config.roundMs);
			}
			expect(game.state.phase).toBe('match-results');
			const match = game.match;
			game.rematch();
			expect(game.match).toBe(match);
			expect(game.state.players).toHaveLength(count);
			expect(game.state.phase).toBe('ready');
			expect(game.state.round).toBe(1);
			expect(game.state.scores).toEqual(emptyScores());
			expect(game.state.stimulus).toBeNull();
			expect(game.state.feedback).toBeNull();
			expect(game.mode.id).toBe('press-on-white');
			game.end();
			expect(game.state.phase).toBe('setup');
			expect(game.state.scores).toEqual(emptyScores());
			game.start();
			expect(game.mode.id).toBe('press-on-white');
		}
	});
});
