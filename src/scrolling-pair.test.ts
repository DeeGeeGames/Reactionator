import {expect, test} from 'bun:test';
import {Game, ANSWER_REVEAL_MS} from './game';
import {difficulties, type Presentation, type Stimulus} from './mode';
import {staticDefaults} from './static-challenges';
import {matchingPair} from './symbol-challenges';
import {commitScrollingRows, hasScrollingPair, scrollingSpeeds, type ScrollingPairStimulus, type ScrollingRows} from './scrolling-pair';

const rows: ScrollingRows = [
	['circle', 'square', 'triangle', 'diamond', 'star', 'pentagon', 'camera', 'pencil'],
	['scissors', 'apple', 'guitar', 'lightbulb', 'envelope', 'shoe', 'teapot', 'square'],
];
const config = staticDefaults('matching-pair');
const boardOf = function(state: Stimulus | null): Extract<Presentation, {kind: 'scrolling-symbols'}> {
	if (state === null) throw new Error('Missing board');
	const board = matchingPair.present(state);
	if (board.kind !== 'scrolling-symbols') throw new Error('Missing scrolling presentation');
	return board;
};
const fixture = function(): ScrollingPairStimulus {
	const items = commitScrollingRows(rows, scrollingSpeeds.easy, 0);
	return {mode: 'matching-pair', showing: 'claim', id: 1, blocked: [], until: config.roundMs, rows, items,
		payload: {kind: 'symbols', symbols: items.filter(function(item) { return item.fullyVisible; }).map(function(item) { return item.kind; })}};
};
const seeded = function(seed: number): () => number {
	let value = seed;
	return function() { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
};

test('two rows move in opposite directions at every difficulty, with stable object identity', function() {
	for (const difficulty of difficulties) {
		const before = commitScrollingRows(rows, scrollingSpeeds[difficulty], 0);
		const after = commitScrollingRows(rows, scrollingSpeeds[difficulty], 100);
		for (const [id, direction] of [['0:1', -1], ['1:1', 1]] as const) {
			const a = before.find(function(item) { return item.id === id; });
			const b = after.find(function(item) { return item.id === id; });
			if (a === undefined || b === undefined) throw new Error('Missing moving item');
			expect(b.kind).toBe(a.kind); expect(b.artIndex).toBe(a.artIndex);
			expect(b.x - a.x).toBeCloseTo(direction * scrollingSpeeds[difficulty] / 10, 8);
		}
	}
});

test('clipped edge fragments do not form a pair; fully visible pairs can be within or across rows', function() {
	const threshold = 21 / scrollingSpeeds.easy * 1000;
	expect(hasScrollingPair(commitScrollingRows(rows, scrollingSpeeds.easy, threshold - 0.001))).toBe(false);
	expect(hasScrollingPair(commitScrollingRows(rows, scrollingSpeeds.easy, threshold + 0.001))).toBe(true);
	expect(hasScrollingPair(commitScrollingRows(rows, scrollingSpeeds.easy, 8000))).toBe(false);
	const sameRow: ScrollingRows = [rows[0].map(function(kind, index) { return index === 2 ? 'circle' : kind; }), rows[1]];
	expect(hasScrollingPair(commitScrollingRows(sameRow, scrollingSpeeds.easy, 0))).toBe(true);
});

test('input judges the last scrolling display, with one penalty until visible identities change', function() {
	const first = fixture();
	const miss = matchingPair.press(first, {player: 1, time: 2400}, config, seeded(1));
	if (miss === null) throw new Error('Expected penalty');
	expect(miss.delta).toBe(-1);
	expect(matchingPair.press(miss.stimulus, {player: 1, time: 2401}, config, seeded(1))).toBeNull();
	const moving = matchingPair.advance(miss.stimulus, 100, config, seeded(1));
	expect(moving.blocked).toEqual([1]); expect(moving.id).toBe(first.id);
	const committed = matchingPair.advance(moving, 2400, config, seeded(1));
	expect(committed.blocked).toEqual([]); expect(hasScrollingPair(boardOf(committed).items)).toBe(true);
	expect(matchingPair.press(committed, {player: 2, time: 2400}, config, seeded(1))?.delta).toBe(1);
	const skipped = matchingPair.advance(first, 8000, config, seeded(1));
	expect(matchingPair.press(skipped, {player: 2, time: 8000}, config, seeded(1))?.delta).toBe(-1);
	expect(boardOf(matchingPair.advance(moving, 8000, config, seeded(1))).items).toEqual(boardOf(skipped).items);
});

test('scrolling answer reveals freeze the winning frame and restart without jumping ahead; pause and deadlines hold', function() {
	let now = 0;
	const game = new Game(function() { return now; }, seeded(4), {rounds: 1, modes: [config]});
	const step = function(ms: number, frame = true): void { now += ms; if (frame) game.frame(); };
	game.select(2); game.start(); game.press(1); game.press(2); step(config.countdownMs);
	expect(hasScrollingPair(boardOf(game.state.stimulus).items)).toBe(false);
	step(2400, false); game.press(1); expect(game.state.scores.total[1]).toBe(-1);
	game.frame(); game.press(2); expect(game.state.scores.total[2]).toBe(1);
	const winning = game.state.answerFeedback?.presentation;
	const fresh = boardOf(game.state.stimulus);
	step(ANSWER_REVEAL_MS - 1); game.press(1);
	expect(game.state.answerFeedback?.presentation).toEqual(winning); expect(game.state.scores.total[1]).toBe(-1);
	step(1); expect(game.state.answerFeedback).toBeNull();
	expect(boardOf(game.state.stimulus).items).toEqual(fresh.items);
	step(100); expect(boardOf(game.state.stimulus).items).not.toEqual(fresh.items);
	game.pause('hidden'); const remaining = game.state.remaining; step(60_000);
	expect(game.state.remaining).toBe(remaining);
	game.resume(); game.press(1); game.press(2); step(config.countdownMs);
	for (const item of boardOf(game.state.stimulus).items) expect((item.x % 30 + 30) % 30).toBeCloseTo(20, 8);
	step(remaining, false); game.press(2);
	expect(game.state.phase).toBe('match-results'); expect(game.state.scores.total[2]).toBe(1);
});
