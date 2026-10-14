import {sample} from './mode';
import type {Difficulty, StaticPayload, WordColor} from './mode';
import {createStaticMode} from './static-challenges';

type ColorWordPayload = Extract<StaticPayload, {kind: 'color-word'}>;
type EquationPayload = Extract<StaticPayload, {kind: 'equation'}>;
type Operator = EquationPayload['operators'][number];

export const wordColors: readonly WordColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'black', 'white'];
const distantColors: Readonly<Record<WordColor, readonly WordColor[]>> = {
	red: ['blue', 'green', 'white'],
	blue: ['red', 'yellow', 'orange'],
	green: ['red', 'purple', 'white'],
	yellow: ['blue', 'purple', 'black'],
	purple: ['green', 'yellow', 'white'],
	orange: ['blue', 'green', 'black'],
	black: ['yellow', 'orange', 'white'],
	white: ['red', 'blue', 'black'],
};
const pick = function<T>(values: readonly T[], random: () => number): T {
	const value = values[Math.floor(sample(random) * values.length)];
	if (value === undefined) throw new Error('Cannot choose from an empty collection');
	return value;
};
const integer = function(max: number, random: () => number): number {
	return Math.floor(sample(random) * (max + 1));
};
export const generateColorWord = function(difficulty: Difficulty, random: () => number): ColorWordPayload {
	const matching = sample(random) < 0.5;
	const word = pick(wordColors, random);
	const options = difficulty === 'easy' || difficulty === 'medium'
		? distantColors[word]
		: wordColors.filter(function(color) { return color !== word; });
	return {kind: 'color-word', word, ink: matching ? word : pick(options, random)};
};
export const isColorWordTrue = function(payload: StaticPayload): boolean {
	return payload.kind === 'color-word' && payload.word === payload.ink;
};

/** Evaluate integer addition/subtraction with multiplication taking precedence. */
export const equationValue = function(operands: readonly number[], operators: readonly Operator[]): number {
	const first = operands[0];
	if (first === undefined || operands.length !== operators.length + 1
		|| operands.some(function(value) { return !Number.isSafeInteger(value); })) {
		throw new Error('Invalid equation operands');
	}
	let total = 0;
	let term = first;
	let sign = 1;
	for (const [index, operator] of operators.entries()) {
		const next = operands[index + 1];
		if (next === undefined) throw new Error('Missing equation operand');
		if (operator === '×') {
			term *= next;
			continue;
		}
		total += sign * term;
		term = next;
		sign = operator === '+' ? 1 : -1;
	}
	return total + sign * term;
};
export const generateEquation = function(difficulty: Difficulty, random: () => number): EquationPayload {
	const truthful = sample(random) < 0.5;
	let operands: readonly number[];
	let operators: readonly Operator[];
	if (difficulty === 'easy') {
		operands = [integer(9, random), integer(9, random)];
		operators = ['+'];
	} else if (difficulty === 'medium') {
		const subtract = sample(random) < 0.5;
		const first = integer(20, random);
		operands = [first, integer(subtract ? first : 20 - first, random)];
		operators = [subtract ? '-' : '+'];
	} else if (difficulty === 'hard') {
		const multiply = sample(random) < 0.5;
		operands = multiply
			? [integer(10, random), integer(10, random)]
			: [integer(10, random), integer(10, random), integer(10, random)];
		operators = multiply ? ['×'] : ['+', '+'];
	} else {
		operands = [integer(12, random), integer(12, random), integer(12, random)];
		operators = ['+', '×'];
	}
	const correct = equationValue(operands, operators);
	if (truthful) return {kind: 'equation', operands, operators, result: correct};
	const offset = integer(1, random) + 1;
	const preferSubtract = sample(random) < 0.5;
	const exceedsMediumRange = difficulty === 'medium' && correct + offset > 20;
	const subtractOffset = correct >= offset && (preferSubtract || exceedsMediumRange);
	return {kind: 'equation', operands, operators, result: correct + (subtractOffset ? -offset : offset)};
};
export const isEquationTrue = function(payload: StaticPayload): boolean {
	return payload.kind === 'equation' && equationValue(payload.operands, payload.operators) === payload.result;
};
export const colorWord = createStaticMode({
	id: 'color-word', name: 'Color Word', prompt: 'Press if the word and the ink match.',
	generate: generateColorWord, isTrue: isColorWordTrue,
});
export const trueEquation = createStaticMode({
	id: 'true-equation', name: 'True Equation', prompt: 'Press if the equation is true.',
	generate: generateEquation, isTrue: isEquationTrue,
});
