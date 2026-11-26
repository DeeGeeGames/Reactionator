import {sample} from '../mode';
import type {SadFacePuzzle} from './contracts';
import {integer, pick} from './random';

export const createFaces = function(random: () => number): SadFacePuzzle {
	return {type: 'sad-face', columns: 6, faces: Array.from({length: 24}, function() {
		return {sad: false, color: pick(['#ff7a72', '#ffc857', '#43c8b8', '#69a9ff', '#b896ff'], random), rotation: pick([0, 90, 180, 270], random)};
	})};
};

export const changeFaces = function(puzzle: SadFacePuzzle, random: () => number): SadFacePuzzle {
	const selected = integer(puzzle.faces.length, random);
	const turn = pick([90, 180, 270, 360], random);
	const toggleExpression = sample(random) < 0.35;
	const alreadySad = puzzle.faces.some(function(face) { return face.sad; });
	return {...puzzle, faces: puzzle.faces.map(function(face, index) {
		return {...face,
			rotation: index === selected ? (face.rotation + turn) % 360 : face.rotation,
			sad: toggleExpression ? !alreadySad && index === selected : face.sad,
		};
	})};
};
