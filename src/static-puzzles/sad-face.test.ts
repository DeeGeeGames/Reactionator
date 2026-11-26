import {expect, test} from 'bun:test';
import {Game, ANSWER_REVEAL_MS} from '../game';
import {difficulties, type Stimulus} from '../mode';
import {staticDefaults} from '../static-challenges';
import type {SadFacePuzzle} from './contracts';
import {changeFaces, createFaces} from './faces';
import {generatePuzzle} from './generate';
import {sadFace} from './sad-face';

const boardOf = function(state: Stimulus | null): SadFacePuzzle {
	if (state === null || state.mode !== 'sad-face' || !('payload' in state)
		|| state.payload.kind !== 'static-puzzle' || state.payload.puzzle.type !== 'sad-face') throw new Error('Missing face board');
	return state.payload.puzzle;
};
const sequence = function(values: readonly number[]): () => number {
	let index = 0;
	return function() { const value = values[index++]; if (value === undefined) throw new Error('Random sequence exhausted'); return value; };
};
const config = staticDefaults('sad-face');

test('every Sad Face run starts with 24 happy faces in six columns, at random quarter turns', function() {
	for (const difficulty of difficulties) {
		const first = sadFace.create(100, 1, {...config, difficulty}, function() { return 0; });
		const board = boardOf(first);
		expect(board.columns).toBe(6); expect(board.faces.length).toBe(24);
		expect(board.faces.every(function(face) { return !face.sad && face.rotation === 0; })).toBe(true);
		expect(first.until).toBe(600);
		expect(generatePuzzle('sad-face', difficulty, function() { return 0; })).toEqual(board);
	}
	const orientations = Array.from({length: 48}, function(_, index) { return index % 2 === 0 ? 0 : Math.floor(index / 2) % 4 / 4; });
	const varied = createFaces(sequence(orientations));
	expect(varied.faces.slice(0, 4).map(function(face) { return face.rotation; })).toEqual([0, 90, 180, 270]);
	expect(varied.faces.every(function(face) { return !face.sad; })).toBe(true);
});

test('random quarter turns can introduce and remove one sad face in every grid position', function() {
	const initial = createFaces(function() { return 0; });
	for (let cell = 0; cell < 24; cell++) {
		for (const [turn, degrees] of [[0, 90], [0.25, 180], [0.5, 270], [0.75, 0]] as const) {
			const sad = changeFaces(initial, sequence([(cell + 0.5) / 24, turn, 0]));
			expect(sad.faces[cell]?.sad).toBe(true);
			expect(sad.faces[cell]?.rotation).toBe(degrees);
			expect(sad.faces.filter(function(face) { return face.sad; }).length).toBe(1);
			const happy = changeFaces(sad, sequence([0, 0, 0]));
			expect(happy.faces.some(function(face) { return face.sad; })).toBe(false);
		}
	}
	const rotationOnly = changeFaces(initial, sequence([0, 0, 0.9]));
	expect(rotationOnly.faces[0]?.rotation).toBe(90);
	expect(rotationOnly.faces.some(function(face) { return face.sad; })).toBe(false);
	expect(initial.faces.every(function(face) { return face.rotation === 0 && !face.sad; })).toBe(true);
});

test('face changes wait 0.5–2 seconds and delayed frames commit one change without clearing locks', function() {
	const first = sadFace.create(0, 1, config, function() { return 0; });
	expect(sadFace.advance(first, 499, config, function() { return 0; })).toBe(first);
	const miss = sadFace.press(first, {player: 1, time: 0}, config, function() { return 0; });
	if (miss === null) throw new Error('Expected penalty');
	const late = sadFace.advance(miss.stimulus, 10_000, config, function() { return 0; });
	expect(late.id).toBe(first.id + 1); expect(late.blocked).toEqual([1]); expect(late.until).toBe(10_500);
	expect(boardOf(late).faces[0]?.rotation).toBe(90);
	expect(boardOf(late).faces[0]?.sad).toBe(true);
	const next = sadFace.advance(late, late.until, config, function() { return 0.999; });
	expect(next.until - late.until).toBeGreaterThanOrEqual(500);
	expect(next.until - late.until).toBeLessThanOrEqual(2000);
	expect(boardOf(next).faces.filter(function(face) { return face.sad; }).length).toBe(1);
});

test('a run restarts happy when every active player is blocked', function() {
	const first = sadFace.create(0, 1, config, function() { return 0; });
	const a = sadFace.press(first, {player: 1, time: 0, players: [1, 2]}, config, function() { return 0; });
	if (a === null) throw new Error('Expected penalty');
	expect(sadFace.press(a.stimulus, {player: 1, time: 1, players: [1, 2]}, config, function() { return 0; })).toBeNull();
	const b = sadFace.press(a.stimulus, {player: 2, time: 2, players: [1, 2]}, config, function() { return 0; });
	if (b === null) throw new Error('Expected penalty');
	expect(b.delta).toBe(-1); expect(b.stimulus.id).toBe(2); expect(b.stimulus.blocked).toEqual([]);
	expect(boardOf(b.stimulus).faces.some(function(face) { return face.sad; })).toBe(false);
});

test('Sad Face scores committed displays, freezes the answer reveal, and restarts happy after pause', function() {
	let now = 0;
	const game = new Game(function() { return now; }, function() { return 0; }, {rounds: 1, modes: [config]});
	const step = function(ms: number, frame = true): void { now += ms; if (frame) game.frame(); };
	game.select(2); game.start(); game.press(1); game.press(2); step(config.countdownMs);
	step(500, false); game.press(1); game.press(1);
	expect(game.state.scores.total[1]).toBe(-1);
	game.frame(); expect(boardOf(game.state.stimulus).faces[0]?.sad).toBe(true);
	expect(game.state.answerFeedback).toBeNull();
	game.press(1); expect(game.state.scores.total[1]).toBe(-1);
	game.press(2); expect(game.state.scores.total[2]).toBe(1);
	const shown = game.state.answerFeedback?.presentation;
	step(ANSWER_REVEAL_MS - 1); game.press(2);
	expect(game.state.answerFeedback?.presentation).toEqual(shown); expect(game.state.scores.total[2]).toBe(1);
	step(1); expect(game.state.answerFeedback).toBeNull();
	expect(boardOf(game.state.stimulus).faces.some(function(face) { return face.sad; })).toBe(false);
	game.pause('hidden'); const remaining = game.state.remaining; step(60_000);
	expect(game.state.remaining).toBe(remaining);
	game.resume(); game.press(1); game.press(2); step(config.countdownMs);
	expect(boardOf(game.state.stimulus).faces.every(function(face) { return !face.sad && face.rotation === 0; })).toBe(true);
	step(remaining, false); game.press(2);
	expect(game.state.phase).toBe('match-results'); expect(game.state.scores.total[2]).toBe(1);
});
