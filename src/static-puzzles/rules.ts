import type {AnswerExplanation} from '../mode';
import type {Puzzle} from './contracts';
import {winningCells} from './boards';
import {alphabet} from './generate';
export const countedIndices = function(puzzle: Extract<Puzzle, {type: 'shape-count'}>): readonly number[] {
	return puzzle.objects.flatMap(function(object, index) { return object.shape === puzzle.filter.shape && object.color === puzzle.filter.color ? [index] : []; });
};
export const puzzleIsTrue = function(puzzle: Puzzle): boolean {
	switch (puzzle.type) {
		case 'sad-face': return puzzle.faces.some(function(face) { return face.sad; });
		case 'shape-count': {
			const count = countedIndices(puzzle).length;
			return puzzle.operator === '=' ? count === puzzle.count : puzzle.operator === '<' ? count < puzzle.count : count > puzzle.count;
		}
		case 'equal-arrows': return puzzle.shafts[0] === puzzle.shafts[1];
		case 'equal-t': return puzzle.barLength === puzzle.stemLength;
		case 'equal-track-bars': return puzzle.bars[0].right - puzzle.bars[0].left === puzzle.bars[1].right - puzzle.bars[1].left;
		case 'four-in-a-line': case 'three-in-a-row': return winningCells(puzzle).length > 0;
		case 'alphabet-order': return puzzle.letters.join('') === alphabet;
		case 'plus-and-minus': {
			const plus = puzzle.signs.filter(function(sign) { return sign === '+'; }).length;
			const minus = puzzle.signs.length - plus;
			return puzzle.statement === 'More pluses' ? plus > minus : puzzle.statement === 'More minuses' ? minus > plus : plus === minus;
		}
	}
};
const dimensions = function(a: number, b: number): AnswerExplanation {
	return {message: `Lengths: ${a.toFixed(1)} and ${b.toFixed(1)} units — ${a === b ? 'equal' : 'unequal'}.`};
};
export const explainPuzzle = function(puzzle: Puzzle): AnswerExplanation {
	switch (puzzle.type) {
		case 'sad-face': {
			const indices = puzzle.faces.flatMap(function(face, index) { return face.sad ? [index] : []; });
			return {message: indices.length > 0 ? 'The outlined face is frowning.' : 'All the faces are smiling.', highlightedSymbols: indices};
		}
		case 'shape-count': return {message: `${countedIndices(puzzle).length} ${puzzle.filter.color} ${puzzle.filter.shape}s.`, highlightedSymbols: countedIndices(puzzle)};
		case 'equal-arrows': return dimensions(...puzzle.shafts);
		case 'equal-t': return dimensions(puzzle.barLength, puzzle.stemLength);
		case 'equal-track-bars': return dimensions(puzzle.bars[0].right - puzzle.bars[0].left, puzzle.bars[1].right - puzzle.bars[1].left);
		case 'four-in-a-line': case 'three-in-a-row': {
			const indices = winningCells(puzzle);
			return {message: indices.length > 0 ? 'The outlined marks form a matching line.' : 'There is no matching line.', highlightedSymbols: indices};
		}
		case 'alphabet-order': return {message: puzzleIsTrue(puzzle) ? 'Alphabet is in order.' : 'Letters break the order.', highlightedSymbols: puzzle.letters.flatMap(function(letter, index) { return letter === alphabet[index] ? [] : [index]; })};
		case 'plus-and-minus': {
			const plus = puzzle.signs.filter(function(sign) { return sign === '+'; }).length;
			return {message: `${plus} pluses; ${puzzle.signs.length - plus} minuses.`};
		}
	}
};
