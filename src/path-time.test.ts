import {describe, expect, test} from 'bun:test';
import {Game, ANSWER_REVEAL_MS} from './game';
import {difficulties, type Stimulus} from './mode';
import {reachable, mouseGraph, cornerFrames} from './maze-graphs';
import {createPathTimeMode, drawingTrue, overlapping, pathTimeDefaults, pathTimeIds, temporalPresets} from './temporal-challenges';
import {claimHoldMs} from './static-challenges';
import type {PathGraph, PathTimeStimulus} from './path-time-types';
const seeded = function(seed: number): (() => number) { let value = seed; return function() { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; }; };
const narrow = function(state: Stimulus | null): PathTimeStimulus {
	if (state === null || (state.mode !== 'mouse-to-cheese' && state.mode !== 'countdown-to-zero' && state.mode !== 'colliding-shapes' && state.mode !== 'corner-to-corner')) throw new Error('Expected path/time state');
	return state;
};
const fixture = function(id: typeof pathTimeIds[number], random = seeded(7)) {
	let time = 0;
	const config = pathTimeDefaults(id);
	const game = new Game(function() { return time; }, random, {rounds: 1, modes: [config]});
	const advance = function(ms: number, frame = true) { time += ms; if (frame) game.frame(); };
	game.select(2); game.start(); game.press(1); game.press(2); advance(config.countdownMs);
	return {game, advance, config};
};
describe('path and temporal modes', function() {
	for (const difficulty of difficulties) {
		test(`${difficulty}: exact countdown slices, delayed frames, expiry and gap`, function() {
			const mode = createPathTimeMode('countdown-to-zero'); const config = pathTimeDefaults('countdown-to-zero', difficulty);
			const first = narrow(mode.create(0, 1, config, seeded(1)));
			const n = temporalPresets[difficulty].startDigit; const slice = claimHoldMs[difficulty] / (n + 1);
			for (let k = 0; k <= n; k += 1) {
				const at = narrow(mode.advance(first, slice * k, config, seeded(1)));
				expect(at.drawing).toEqual({kind: 'countdown', digit: n - k}); expect(at.id).toBe(first.id);
				if (k > 0) expect(narrow(mode.advance(first, slice * k - 1e-7, config, seeded(1))).drawing).toEqual({kind: 'countdown', digit: n - k + 1});
			}
			const skipped = narrow(mode.advance(first, claimHoldMs[difficulty] + 1, config, seeded(1)));
			expect(skipped.showing).toBe('gap'); expect(mode.press(skipped, {player: 1, time: skipped.until}, config, seeded(1))).toBeNull();
		});
		test(`${difficulty}: seeded graphs, equal mouse density, true and false topologies`, function() {
			const truths = new Set<boolean>();
			for (let seed = 1; seed <= 40; seed += 1) {
				const graph = mouseGraph(difficulty, seeded(seed * 600)); truths.add(reachable(graph));
				expect(graph).toEqual(mouseGraph(difficulty, seeded(seed * 600)));
				const opposite = mouseGraph(difficulty, function() { return seed % 2 ? 0.1 : 0.9; });
				expect(graph.edges.length).toBe(opposite.edges.length); expect(graph.nodes.length).toBe(opposite.nodes.length);
				const frames = cornerFrames(difficulty, seeded(seed));
				expect(frames.map(reachable)).toEqual([false, true, false, true, false]);
			}
			expect(truths.size).toBe(2);
		});
		test(`${difficulty}: collision separated initially, overlap, separation, false clearance, replay`, function() {
			const mode = createPathTimeMode('colliding-shapes'); const config = pathTimeDefaults('colliding-shapes', difficulty);
			for (const value of [0.1, 0.9]) {
				const first = narrow(mode.create(0, 1, config, function() { return value; }));
				expect(first).toEqual(narrow(mode.create(0, 1, config, function() { return value; })));
				expect(drawingTrue(first.drawing)).toBe(false);
				if (first.plan.kind !== 'collision') throw new Error('Expected collision');
				const at = narrow(mode.advance(first, first.plan.centerAt, config, seeded(1)));
				expect(drawingTrue(at.drawing)).toBe(value < 0.7);
				const after = narrow(mode.advance(first, first.plan.centerAt + 500, config, seeded(1)));
				expect(drawingTrue(after.drawing)).toBe(false);
				const stepped = mode.advance(mode.advance(first, 100, config, seeded(1)), 900, config, seeded(1));
				expect(stepped).toEqual(mode.advance(first, 900, config, seeded(1)));
			}
		});
	}
	test('strict collision geometry: tangency and epsilon', function() {
		for (const [distance, truth] of [[24, false], [24.000001, false], [23.999999, true]] as const) expect(overlapping([{x: 0, y: 0, radius: 12}, {x: distance, y: 0, radius: 12}])).toBe(truth);
	});
	test('crossings do not join, explicit junctions do; diagonals do not invent passages', function() {
		const graph: PathGraph = {crossing: 'bridge', start: 'a', goal: 'd', nodes: [{id: 'a', x: 0, y: 0}, {id: 'b', x: 10, y: 10}, {id: 'c', x: 0, y: 10}, {id: 'd', x: 10, y: 0}], edges: [{from: 'a', to: 'b'}, {from: 'c', to: 'd'}]};
		expect(reachable(graph)).toBe(false); expect(reachable({...graph, edges: [...graph.edges, {from: 'b', to: 'c'}]})).toBe(true);
		expect(reachable({...graph, goal: 'isolated', nodes: [...graph.nodes, {id: 'isolated', x: 20, y: 20}]})).toBe(false);
	});
	for (const id of pathTimeIds) {
		test(`${id}: committed input, locks, eligible second player, reveal and deadline`, function() {
			const {game, advance} = fixture(id, function() { return 0.1; });
			const initial = narrow(game.state.stimulus);
			if (id !== 'mouse-to-cheese') {
				// Wall time reaches a true schedule without a frame: input still judges the initial false display.
				const elapsed = id === 'countdown-to-zero' ? 4000 : id === 'corner-to-corner' ? 2500 : initial.plan.kind === 'collision' ? initial.plan.centerAt : 0;
				advance(elapsed, false); game.press(1); expect(game.state.scores.total[1]).toBe(-1);
				game.press(1); expect(game.state.scores.total[1]).toBe(-1);
				game.frame(); expect(narrow(game.state.stimulus).id).toBe(initial.id);
				expect(drawingTrue(narrow(game.state.stimulus).drawing)).toBe(true);
				game.press(1); expect(game.state.scores.total[1]).toBe(-1);
			}
			game.press(2); expect(game.state.scores.total[2]).toBe(1);
			expect(game.state.answerFeedback?.delta).toBe(1); const shown = game.state.answerFeedback?.presentation;
			advance(ANSWER_REVEAL_MS - 1); game.press(2); expect(game.state.scores.total[2]).toBe(1); expect(game.state.answerFeedback?.presentation).toEqual(shown);
			advance(1); expect(game.state.answerFeedback).toBeNull();
			advance(30_000, false); game.press(2); expect(game.state.scores.total[2]).toBe(1); expect(game.state.phase).toBe('match-results');
		});
		test(`${id}: pause discards opportunity and resumes fresh`, function() {
			const {game, advance, config} = fixture(id);
			advance(300); const remaining = game.state.remaining; const old = narrow(game.state.stimulus);
			game.pause('test'); advance(9000); game.press(1); expect(game.state.stimulus).toBeNull(); expect(game.state.remaining).toBe(remaining);
			game.resume(); game.press(1); game.press(2); advance(config.countdownMs);
			const fresh = narrow(game.state.stimulus); expect(fresh.id).toBeGreaterThan(old.id); expect(fresh.blocked).toEqual([]); expect(game.state.remaining).toBe(remaining);
		});
	}
	test('changing maze: removed bridge, skipped connected frame, lock identity', function() {
		const mode = createPathTimeMode('corner-to-corner'); const config = pathTimeDefaults('corner-to-corner');
		const first = narrow(mode.create(0, 1, config, function() { return 0.1; }));
		const miss = mode.press(first, {player: 1, time: 0}, config, seeded(1)); if (miss === null) throw new Error('Expected miss');
		const removed = narrow(mode.advance(miss.stimulus, 5000, config, seeded(1)));
		expect(removed.id).toBe(first.id); expect(removed.blocked).toEqual([1]); expect(drawingTrue(removed.drawing)).toBe(false);
		expect(mode.press(removed, {player: 2, time: 5000}, config, seeded(1))?.delta).toBe(-1);
	});
	test('last committed true drawing remains authoritative until a frame, deadline excepted', function() {
		for (const id of ['countdown-to-zero', 'colliding-shapes', 'corner-to-corner'] as const) {
			const {game, advance} = fixture(id, function() { return 0.1; });
			const first = narrow(game.state.stimulus);
			advance(id === 'countdown-to-zero' ? 4000 : id === 'corner-to-corner' ? 2500 : first.plan.kind === 'collision' ? first.plan.centerAt : 0);
			expect(drawingTrue(narrow(game.state.stimulus).drawing)).toBe(true);
			advance(1500, false); game.press(1); expect(game.state.scores.total[1]).toBe(1);
		}
	});
	test('false mouse claims and false maze schedules retain locks and never disclose truth through density', function() {
		for (const difficulty of difficulties) for (const id of ['mouse-to-cheese', 'corner-to-corner'] as const) {
			const mode = createPathTimeMode(id); const config = pathTimeDefaults(id, difficulty);
			const first = narrow(mode.create(0, 1, config, function() { return 0.9; }));
			const miss = mode.press(first, {player: 1, time: 0}, config, seeded(1)); if (miss === null) throw new Error('Expected miss');
			expect(miss.delta).toBe(-1); expect(mode.press(miss.stimulus, {player: 1, time: 1}, config, seeded(1))).toBeNull();
			for (let elapsed = 0; elapsed < first.until; elapsed += 100) expect(drawingTrue(narrow(mode.advance(first, elapsed, config, seeded(1))).drawing)).toBe(false);
		}
	});
	test('collision: skipped overlap never receives retrospective point', function() {
		const mode = createPathTimeMode('colliding-shapes'); const config = pathTimeDefaults('colliding-shapes');
		const first = narrow(mode.create(0, 1, config, function() { return 0.1; })); if (first.plan.kind !== 'collision') throw new Error('Expected collision');
		const late = mode.advance(first, first.plan.centerAt + 700, config, seeded(1)); expect(mode.press(late, {player: 1, time: first.plan.centerAt + 700}, config, seeded(1))?.delta).toBe(-1);
	});
});

test('mouse dead-end marker stays clear of unrelated rendered curves', function() {
	for (const difficulty of difficulties) for (const value of [0.1, 0.9]) {
		const graph = mouseGraph(difficulty, function() { return value; });
		const dead = graph.nodes.find(function(node) { return node.id === 'dead'; });
		if (dead === undefined) throw new Error('Missing dead end');
		for (const edge of graph.edges) {
			if (edge.from === dead.id || edge.to === dead.id) continue;
			const from = graph.nodes.find(function(node) { return node.id === edge.from; });
			const to = graph.nodes.find(function(node) { return node.id === edge.to; });
			if (from === undefined || to === undefined) throw new Error('Missing endpoint');
			for (let i = 0; i <= 1000; i++) {
				const t = i / 1000; const u = 1 - t;
				const [x, y] = edge.curve === undefined ? [from.x * u + to.x * t, from.y * u + to.y * t]
					: [u ** 3 * from.x + 3 * u ** 2 * t * edge.curve[0].x + 3 * u * t ** 2 * edge.curve[1].x + t ** 3 * to.x,
						u ** 3 * from.y + 3 * u ** 2 * t * edge.curve[0].y + 3 * u * t ** 2 * edge.curve[1].y + t ** 3 * to.y];
				// 0.8-radius marker + 0.6 half-stroke + visible clearance.
				expect(Math.hypot(dead.x - x, dead.y - y)).toBeGreaterThan(2.4);
			}
		}
	}
});
