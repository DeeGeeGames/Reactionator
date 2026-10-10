import {describe, expect, test} from 'bun:test';
import {Game} from './game';
import {defaults, emptyScores, pressOnWhite, reduceScore, roster, validateConfig, type Config} from './mode';
const fixture = function(overrides: Partial<Config> = {}, random: () => number = () => 0) {
	let time = 0;
	const game = new Game(() => time, random, {...defaults, ...overrides});
	return {game, advance: function(ms: number, frame = true) { time += ms; if (frame) game.frame(); }};
};
const begin = function(game: Game, advance: (ms: number) => void, count = 4) {
	game.select(count); game.start();
	for (const player of game.state.players) game.press(player);
	advance(game.config.countdownMs);
};
describe('configuration and score boundary', function() {
	test('rejects invalid configuration and roster', function() {
		for (const config of [{...defaults, roundMs: NaN}, {...defaults, rounds: 0}, {...defaults, gap: [0, 2] as const}, {...defaults, probabilities: [0, 0, 0, 0] as const}]) {
			expect(() => validateConfig(config)).toThrow();
		}
		expect(() => roster(1)).toThrow();
		expect(roster(2)).toEqual([1, 3]); expect(roster(3)).toEqual([1, 2, 3]);
	});
	test('negative totals, event deduplication, and inactive player rejection', function() {
		const event = {id: 'a', player: 1, delta: -1} as const;
		const scores = reduceScore(emptyScores(), event, [1, 3]);
		expect(scores.total[1]).toBe(-1);
		expect(reduceScore(scores, event, [1, 3])).toBe(scores);
		expect(() => reduceScore(scores, {id: 'b', player: 2, delta: 1}, [1, 3])).toThrow();
		expect(() => reduceScore(scores, {...event, id: ''}, [1, 3])).toThrow();
	});
});
describe('committed mode and timing fairness', function() {
	test('unrendered scheduled white remains blank and false start carries into white', function() {
		const {game, advance} = fixture(); begin(game, advance);
		advance(300, false); game.press(1); game.press(1);
		expect(game.state.stimulus?.color).toBe(null); expect(game.state.scores.total[1]).toBe(-1);
		game.frame(); expect(game.state.stimulus?.color).toBe('white');
		game.press(1); expect(game.state.scores.total[1]).toBe(-1);
		game.press(3); expect(game.state.scores.total[3]).toBe(1); expect(game.state.stimulus?.color).toBe(null);
	});
	test('equal timestamps follow arrival order; claimed white clears before later press', function() {
		const {game, advance} = fixture(); begin(game, advance); advance(250);
		game.press(4); game.press(1); game.press(1);
		expect(game.state.scores.total[4]).toBe(1); expect(game.state.scores.total[1]).toBe(-1);
		advance(250); game.press(1); expect(game.state.scores.total[1]).toBe(-1);
		game.press(4); expect(game.state.scores.total[4]).toBe(2);
	});
	test('nonwhite penalties are bounded, renewed at next appearance', function() {
		const {game, advance} = fixture({}, () => 0.5); begin(game, advance); advance(375);
		expect(game.state.stimulus?.color).toBe('blue'); game.press(2); game.press(2);
		expect(game.state.scores.total[2]).toBe(-1); advance(1050); advance(375); game.press(2);
		expect(game.state.scores.total[2]).toBe(-2);
	});
	test('unclaimed or wholly ineligible white expires without points', function() {
		const {game, advance} = fixture(); begin(game, advance);
		for (const p of game.state.players) game.press(p);
		advance(250); for (const p of game.state.players) game.press(p);
		expect(Object.values(game.state.scores.total)).toEqual([-1, -1, -1, -1]);
		advance(700); expect(game.state.stimulus?.color).toBe(null); advance(250); advance(700);
		expect(Object.values(game.state.scores.total)).toEqual([-1, -1, -1, -1]);
	});
	test('at deadline input is rejected even before the next frame', function() {
		const {game, advance} = fixture({roundMs: 1000}); begin(game, advance); advance(250);
		advance(750, false); game.press(1);
		expect(game.state.phase).toBe('round-results'); expect(game.state.scores.total[1]).toBe(0);
		game.press(1); expect(game.state.scores.total[1]).toBe(0);
	});
	test('seeded schedule reproduces and repeated whites keep distinct identities', function() {
		const seeded = function() { let seed = 123; return function() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; };
		const a = fixture({}, seeded()); const b = fixture({}, seeded()); begin(a.game, a.advance); begin(b.game, b.advance);
		for (let index = 0; index < 40; index++) { a.advance(500); b.advance(500); expect(a.game.state.stimulus).toEqual(b.game.state.stimulus); }
		const one = pressOnWhite.create(0, 1, defaults, () => 0);
		const white = pressOnWhite.advance(one, 250, defaults, () => 0);
		const gap = pressOnWhite.advance(white, 950, defaults, () => 0);
		const next = pressOnWhite.advance(gap, 1200, defaults, () => 0);
		expect(next.color).toBe('white'); expect(next.id).not.toBe(white.id);
	});
});
describe('match lifecycle', function() {
	test('inactive input and readiness never score', function() {
		const {game, advance} = fixture(); game.press(1); expect(game.state.phase).toBe('setup'); game.start();
		game.press(1); game.press(1); expect(game.state.ready).toEqual([1]);
		for (const p of [2, 3, 4] as const) game.press(p);
		game.press(1); advance(2999); game.press(3);
		expect(game.state.phase).toBe('countdown'); expect(game.state.scores.total[1]).toBe(0);
	});
	test('pause freezes active time; repeated pauses retain scores and resume into fresh gap', function() {
		const {game, advance} = fixture(); begin(game, advance); advance(250); game.press(1); advance(200);
		game.pause('hidden'); const remaining = game.state.remaining;
		game.press(2); advance(60_000); game.pause('again'); expect(game.state.remaining).toBe(remaining);
		game.resume(); for (const p of game.state.players) game.press(p); advance(3000);
		expect(game.state.phase).toBe('playing'); expect(game.state.stimulus?.color).toBe(null);
		expect(game.state.remaining).toBe(remaining); expect(game.state.scores.total[1]).toBe(1);
		advance(100); game.pause('again'); expect(game.state.remaining).toBe(remaining - 100);
	});
	test('countdown interruption needs all players again and a complete countdown', function() {
		const {game, advance} = fixture(); game.start(); for (const p of game.state.players) game.press(p);
		advance(1500); game.pause('layout'); advance(9000); game.resume(); game.press(1);
		expect(game.state.phase).toBe('ready'); for (const p of [2, 3, 4] as const) game.press(p);
		advance(2999); expect(game.state.phase).toBe('countdown'); advance(1); expect(game.state.phase).toBe('playing');
		expect(game.state.remaining).toBe(20_000);
	});
	test('deadline pause finishes the round, interrupted results advance only once', function() {
		const {game, advance} = fixture({roundMs: 500}); begin(game, advance); advance(500, false); game.pause('hidden');
		expect(game.state.phase).toBe('round-results'); game.pause('hidden'); expect(game.state.phase).toBe('paused');
		game.resume(); expect(game.state.phase).toBe('round-results');
		for (const p of game.state.players) game.press(p); expect(game.state.round).toBe(2);
	});
	test('five rounds for each roster, round totals reset, rematch and end clear totals', function() {
		for (const count of [2, 3, 4]) {
			const {game, advance} = fixture({roundMs: 500}); begin(game, advance, count);
			for (let round = 1; round <= 5; round++) {
				game.press(1); advance(500); expect(game.state.scores.total[1]).toBe(-round);
				if (round < 5) { for (const p of game.state.players) game.press(p); advance(3000); expect(game.state.scores.round[1]).toBe(0); }
			}
			expect(game.state.phase).toBe('match-results'); game.rematch(); expect(game.state.players.length).toBe(count);
			expect(game.state.scores.total[1]).toBe(0); expect(game.state.phase).toBe('ready');
			game.end(); expect(game.state.phase).toBe('setup'); expect(game.state.scores.total[1]).toBe(0);
		}
	});
});
