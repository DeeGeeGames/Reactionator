import {sample, type Difficulty} from '../mode';
import type {CountObject, Puzzle, PuzzleModeId} from './contracts';
import {generateFourBoard, generateThreeBoard} from './boards';
import {integer, pick, shuffle} from './random';
export const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// Ticket presets are provisional review values, not historical measurements.
const level: Readonly<Record<Difficulty, number>> = {easy: 0, medium: 1, hard: 2, insane: 3};
const atLevel = function<T>(values: readonly [T, T, T, T], difficulty: Difficulty): T {
	const value = values[level[difficulty]];
	if (value === undefined) throw new Error('Missing preset');
	return value;
};
export const generatePuzzle = function(id: PuzzleModeId, difficulty: Difficulty, random: () => number): Puzzle {
	if (id === 'three-in-a-row') return generateThreeBoard(difficulty, random);
	if (id === 'four-in-a-line') return generateFourBoard(difficulty, random);
	const truth = sample(random) < 0.5;
	if (id === 'sad-face') {
		const [columns, rows] = atLevel([[3, 3], [4, 4], [5, 4], [6, 5]] as const, difficulty);
		const target = integer(columns * rows, random);
		return {type: id, columns, faces: Array.from({length: columns * rows}, function(_, index) {
			return {sad: truth && index === target, rotation: pick(difficulty === 'easy' ? [0, 180] : [0, 45, 90, 135, 180, 225, 270, 315], random), color: pick(['#ff7a72', '#ffc857', '#43c8b8', '#69a9ff', '#b896ff'], random)};
		})};
	}
	if (id === 'shape-count') {
		const objects = Array.from({length: atLevel([8, 14, 20, 28], difficulty)}, function(): CountObject {
			return {shape: pick(['circle', 'square', 'triangle'] as const, random), color: pick(['red', 'blue', 'green'] as const, random)};
		});
		const filter: CountObject = {shape: pick(['circle', 'square', 'triangle'] as const, random), color: pick(['red', 'blue', 'green'] as const, random)};
		const actual = objects.filter(function(object) { return object.shape === filter.shape && object.color === filter.color; }).length;
		const operator = pick(['<', '>', '='] as const, random);
		const count = operator === '=' ? actual + (truth ? 0 : 1) : operator === '>' ? (truth && actual > 0 ? actual - 1 : actual) : actual + (truth ? 1 : 0);
		// Zero cannot be greater than a nonnegative count; use an equality claim instead.
		return {type: id, objects, filter, operator: operator === '>' && truth && actual === 0 ? '=' : operator, count};
	}
	if (id === 'alphabet-order') {
		const letters = [...alphabet];
		if (!truth) {
			const distance = atLevel([1, 2, 1, 13], difficulty);
			const first = integer(26 - distance, random); const second = first + distance;
			const a = letters[first]; const b = letters[second];
			if (a === undefined || b === undefined) throw new Error('Invalid alphabet index');
			letters[first] = b; if (difficulty !== 'hard') letters[second] = a;
		}
		return {type: id, letters};
	}
	if (id === 'plus-and-minus') {
		const total = atLevel([8, 12, 16, 22], difficulty);
		const relation = integer(3, random);
		const margin = difficulty === 'easy' ? 2 : 1;
		const plus = total / 2 + (relation === 0 ? margin : relation === 1 ? -margin : 0);
		const statements = ['More pluses', 'More minuses', 'The same number'] as const;
		const correct = statements[relation]; if (correct === undefined) throw new Error('Missing relation');
		return {type: id, signs: shuffle(Array.from({length: total}, function(_, index) { return index < plus ? '+' as const : '−' as const; }), random), statement: truth ? correct : pick(statements.filter(function(s) { return s !== correct; }), random)};
	}
	const longer = 130 + integer(21, random);
	const shorter = truth ? longer : longer * (1 - atLevel([0.18, 0.12, 0.08, 0.05], difficulty));
	const lengths: readonly [number, number] = sample(random) < 0.5 ? [longer, shorter] : [shorter, longer];
	if (id === 'equal-arrows') return {type: id, shafts: lengths, finAngle: 25 + integer(21, random)};
	if (id === 'equal-t') return {type: id, barLength: lengths[0], stemLength: lengths[1]};
	return {type: id, bars: [{left: 150 - lengths[0] / 2, right: 150 + lengths[0] / 2}, {left: 150 - lengths[1] / 2, right: 150 + lengths[1] / 2}], convergence: 20 + integer(16, random)};
};
