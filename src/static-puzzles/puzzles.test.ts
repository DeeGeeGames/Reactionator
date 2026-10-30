import {describe, expect, test} from 'bun:test';
import {Game} from '../game';
import {difficulties, requireMode, type Difficulty, type StaticStimulus} from '../mode';
import {defaultConfigFor} from '../modes';
import {createPointerTracker} from '../input';
import {puzzleModeIds, type Mark, type Puzzle, type PuzzleModeId} from './contracts';
import {generatePuzzle, alphabet} from './generate';
import {puzzleIsTrue} from './rules';
import {isReachableThreeBoard, winningCells} from './boards';
const seeded = function(seed: number): () => number { let state = seed; return function() { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; };
const claim = function(game: Game): StaticStimulus {
	const state = game.state.stimulus;
	if (state === null || !('showing' in state) || !('payload' in state)) throw new Error('Expected static claim');
	return state;
};
const setup = function(id: PuzzleModeId, random: () => number = seeded(42)) {
	let now = 0;
	const config = defaultConfigFor(id);
	const game = new Game(function() { return now; }, random, {rounds: 1, modes: [config]});
	const step = function(ms: number, frame = true) { now += ms; if (frame) game.frame(); };
	game.select(2); game.start(); game.press(1); game.press(2); step(config.countdownMs);
	return {game, step};
};
describe('static puzzle families', function() {
	for (const id of puzzleModeIds) {
		for (const difficulty of difficulties) test(`${id} ${difficulty}: deterministic balanced displayed-data predicates`, function() {
			const random = seeded(12); const replay = seeded(12); const truths = new Set<boolean>(); let trueCount = 0;
			for (let i = 0; i < 160; i++) {
				const puzzle = generatePuzzle(id, difficulty, random);
				expect(puzzle).toEqual(generatePuzzle(id, difficulty, replay));
				truths.add(puzzleIsTrue(puzzle)); if (puzzleIsTrue(puzzle)) trueCount++;
				if (puzzle.type === 'three-in-a-row') expect(isReachableThreeBoard(puzzle.cells)).toBe(true);
				if (puzzle.type === 'sad-face') expect(puzzle.faces.filter(function(face) { return face.sad; }).length).toBeLessThanOrEqual(1);
			}
			expect(truths.size).toBe(2); expect(trueCount).toBeGreaterThan(50); expect(trueCount).toBeLessThan(110);
			const config = defaultConfigFor(id);
			if (!('difficulty' in config)) throw new Error('Missing difficulty');
			const mode = requireMode(id);
			const selected = {...config, difficulty};
			expect(mode.validate(selected)).toEqual(selected);
			expect(mode.present(mode.create(0, 1, selected, seeded(7))).kind).toBe('static-puzzle');
		});
		test(`${id}: committed display, lockout, reveal suppression, pause and deadline`, function() {
			const {game} = setup(id, function() { return 0.9; });
			game.press(1); game.press(1); expect(game.state.scores.total[1]).toBe(-1);
			game.press(2); expect(game.state.scores.total[2]).toBe(-1);
			// Separate match prevents the seek consuming the round deadline.
			const next = setup(id, function() { return 0; });
			const initial = claim(next.game);
			if (initial.showing !== 'claim' || initial.payload.kind !== 'static-puzzle') throw new Error('Missing claim');
			expect(puzzleIsTrue(initial.payload.puzzle)).toBe(true);
			const config = next.game.config;
			if (!('difficulty' in config)) throw new Error('Missing difficulty');
			const holds: Readonly<Record<Difficulty, number>> = {easy: 5000, medium: 3500, hard: 2500, insane: 1800};
			next.step(holds[config.difficulty] + 1, false); next.game.press(2);
			expect(next.game.state.scores.total[2]).toBe(1);
			expect(next.game.state.answerFeedback?.presentation).toEqual(next.game.mode.present(initial));
			next.game.press(1); expect(next.game.state.scores.total[1]).toBe(0);
			next.step(1999); expect(next.game.state.answerFeedback?.delta).toBe(1);
			next.step(1); expect(next.game.state.answerFeedback).toBeNull();
			const tracker = createPointerTracker(function(player) { next.game.press(player); });
			tracker.pointerDown(1, 1); next.step(2000); tracker.pointerDown(1, 1);
			expect(next.game.state.scores.total[1]).toBe(1); tracker.pointerUp(1); tracker.dispose();
			next.game.pause('test'); const remaining = next.game.state.remaining; next.step(60000);
			expect(next.game.state.remaining).toBe(remaining);
			next.game.resume(); next.game.press(1); next.game.press(2); next.step(config.countdownMs);
			next.step(remaining, false); next.game.press(1); expect(next.game.state.phase).toBe('match-results');
			expect(next.game.state.scores.total[1]).toBe(1);
		});
	}
});
const board = function(cells: readonly Mark[], columns = 3, rows = 3): Extract<Puzzle, {type: 'three-in-a-row' | 'four-in-a-line'}> {
	return {type: columns === 3 ? 'three-in-a-row' : 'four-in-a-line', columns, rows, cells};
};
test('all eight tic tac toe lines, either mark, legal dual line and draw=false', function() {
	for (const mark of ['A', 'B'] as const) for (const indices of [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]]) {
		expect(puzzleIsTrue(board(Array.from({length: 9}, function(_, index) { return indices.includes(index) ? mark : null; })))).toBe(true);
	}
	expect(puzzleIsTrue(board(['A','B','A','A','B','B','B','A','A']))).toBe(false);
	expect(isReachableThreeBoard(['A','A','A','B','B','B',null,null,null])).toBe(false);
	expect(isReachableThreeBoard(['A','B','A','B','A','B','A','B','A'])).toBe(true);
});
test('four line directions, either mark, long runs, empty breaks, no wrapping', function() {
	for (const mark of ['A','B'] as const) for (const indices of [[0,1,2,3,4], [0,5,10,15], [0,6,12,18], [4,8,12,16]]) {
		const cells = Array.from({length: 25}, function(_, index) { return indices.includes(index) ? mark : null; });
		expect(winningCells(board(cells, 5, 5)).length).toBeGreaterThanOrEqual(4);
	}
	for (const indices of [[3,4,5,6], [0,1,3,4], [0,1,2], [0,1,6,11]]) expect(puzzleIsTrue(board(Array.from({length: 25}, function(_, index) { return indices.includes(index) ? 'A' : null; }), 5, 5))).toBe(false);
});
test('full no-line disc board, zero count, and every sad-face target position', function() {
	const cells = Array.from({length: 25}, function(_, index): Mark { return (index % 5 + 2 * Math.floor(index / 5)) % 4 < 2 ? 'A' : 'B'; });
	expect(puzzleIsTrue(board(cells, 5, 5))).toBe(false);
	expect(puzzleIsTrue({type: 'shape-count', objects: [], filter: {shape: 'square', color: 'blue'}, operator: '=', count: 0})).toBe(true);
	for (let target = 0; target < 30; target++) expect(puzzleIsTrue({type: 'sad-face', columns: 6, faces: Array.from({length: 30}, function(_, index) { return {sad: index === target, rotation: index * 45, color: 'red'}; })})).toBe(true);
});
test('face, alphabet, shape inequality/color filters, all sign relations and illusion dimensions', function() {
	expect(puzzleIsTrue({type: 'sad-face', columns: 1, faces: [{sad: true, rotation: 180, color: 'red'}, {sad: true, rotation: 90, color: 'blue'}]})).toBe(true);
	for (const letters of [alphabet, 'ABCDEFGHIJKLN MOPQRSTUVWXYZ'.replaceAll(' ', ''), alphabet.slice(1), alphabet.replace('Z','A')]) expect(puzzleIsTrue({type:'alphabet-order', letters: [...letters]})).toBe(letters === alphabet);
	const objects = [{shape:'square', color:'blue'}, {shape:'square',color:'red'}, {shape:'square',color:'blue'}] as const;
	for (const [operator,count,truth] of [['=',2,true], ['=',3,false], ['>',2,false], ['<',3,true], ['=',0,false]] as const) expect(puzzleIsTrue({type:'shape-count', objects, filter:{shape:'square',color:'blue'},operator,count})).toBe(truth);
	for (const signs of [['+','+'], ['−','−'], ['+','−']] as const) for (const statement of ['More pluses','More minuses','The same number'] as const) {
		const plus = signs.filter(function(sign) { return sign === '+'; }).length;
		expect(puzzleIsTrue({type:'plus-and-minus',signs,statement})).toBe(statement === 'More pluses' ? plus > 1 : statement === 'More minuses' ? plus < 1 : plus === 1);
	}
	for (const [a,b] of [[120,120], [120,100], [100,120]] as const) {
		expect(puzzleIsTrue({type:'equal-arrows',shafts:[a,b],finAngle:45})).toBe(a === b);
		expect(puzzleIsTrue({type:'equal-t',barLength:a,stemLength:b})).toBe(a === b);
		expect(puzzleIsTrue({type:'equal-track-bars',bars:[{left:0,right:a},{left:50,right:50+b}],convergence:20})).toBe(a === b);
	}
});
