import {createStaticMode} from '../static-challenges';
import {puzzleModeIds, type PuzzleModeId} from './contracts';
import {generatePuzzle} from './generate';
import {explainPuzzle, puzzleIsTrue} from './rules';
const labels: Readonly<Record<PuzzleModeId, readonly [string, string]>> = {
	'sad-face': ['Sad Face', 'Press if a face is sad.'],
	'shape-count': ['Shape Count', 'Press if the shape count is correct.'],
	'equal-arrows': ['Equal Arrows', 'Press if the two shafts are equal.'],
	'equal-t': ['Equal T', 'Press if the two strokes are equal.'],
	'equal-track-bars': ['Equal Track Bars', 'Press if the two bars are equal.'],
	'four-in-a-line': ['Four in a Line', 'Press if four matching discs form a line.'],
	'alphabet-order': ['Alphabet Order', 'Press if the alphabet is in order.'],
	'three-in-a-row': ['Three in a Row', 'Press if three Xs or Os line up.'],
	'plus-and-minus': ['Plus and Minus', 'Press if the statement matches the signs.'],
};
export const puzzleModes = puzzleModeIds.map(function(id) {
	return createStaticMode({
		id, name: labels[id][0], prompt: labels[id][1],
		generate: function(difficulty, random) { return {kind: 'static-puzzle', puzzle: generatePuzzle(id, difficulty, random)}; },
		isTrue: function(payload) { return payload.kind === 'static-puzzle' && payload.puzzle.type === id && puzzleIsTrue(payload.puzzle); },
		explain: function(payload) { return payload.kind === 'static-puzzle' ? explainPuzzle(payload.puzzle) : {message: 'No puzzle displayed.'}; },
	});
});
