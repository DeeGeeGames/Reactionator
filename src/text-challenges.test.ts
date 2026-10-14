import {describe, expect, test} from 'bun:test';
import {difficulties} from './mode';
import type {StaticPayload} from './mode';
import {equationValue, generateColorWord, generateEquation, isColorWordTrue, isEquationTrue, wordColors} from './text-challenges';

const scripted = function(...values: readonly number[]): () => number {
	let index = 0;
	return function() {
		const value = values[index++];
		if (value === undefined) throw new Error('Scripted random source exhausted');
		return value;
	};
};
const seeded = function(seed: number): () => number {
	let state = seed;
	return function() {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 4294967296;
	};
};

describe('color-word generation', function() {
	for (const difficulty of difficulties) {
		test(`${difficulty} fixes the answer before presentation`, function() {
			const match = generateColorWord(difficulty, scripted(0, 0));
			const mismatch = generateColorWord(difficulty, scripted(0.75, 0, 0));
			expect(match).toEqual({kind: 'color-word', word: 'red', ink: 'red'});
			expect(isColorWordTrue(match)).toBe(true);
			expect(isColorWordTrue(mismatch)).toBe(false);
			expect(wordColors).toContain(mismatch.ink);
		});
	}
	test('easy red mismatches exclude neighboring orange and purple', function() {
		const inks = [0, 0.34, 0.99].map(function(value) {
			return generateColorWord('easy', scripted(0.75, 0, value)).ink;
		});
		expect(inks).toEqual(['blue', 'green', 'white']);
	});
	test('all eight words have distant easy mismatches', function() {
		for (const [index, word] of wordColors.entries()) {
			const mismatch = generateColorWord('easy', scripted(0.75, index / wordColors.length, 0));
			expect(mismatch.word).toBe(word);
			expect(mismatch.ink).not.toBe(word);
		}
	});
	test('hard and insane allow neighboring hues', function() {
		for (const difficulty of ['hard', 'insane'] as const) {
			const claim = generateColorWord(difficulty, scripted(0.75, 0, 0.6));
			expect(claim).toEqual({kind: 'color-word', word: 'red', ink: 'orange'});
		}
	});
});

describe('equation generation', function() {
	test('multiplication takes precedence over addition and subtraction', function() {
		expect(equationValue([2, 3, 4], ['+', '×'])).toBe(14);
		expect(equationValue([20, 3, 4], ['-', '×'])).toBe(8);
		expect(equationValue([2, 3, 4], ['×', '+'])).toBe(10);
	});
	test('malformed expressions fail explicitly', function() {
		expect(function() { equationValue([], []); }).toThrow();
		expect(function() { equationValue([1], ['+']); }).toThrow();
		expect(function() { equationValue([1.5, 2], ['+']); }).toThrow();
	});
	test('hard multiplication includes zero factors', function() {
		const claim = generateEquation('hard', scripted(0, 0, 0, 0.99));
		expect(claim).toEqual({kind: 'equation', operands: [0, 10], operators: ['×'], result: 0});
		expect(isEquationTrue(claim)).toBe(true);
	});
	test('insane produces a precedence-sensitive expression', function() {
		const claim = generateEquation('insane', scripted(0, 2 / 13, 3 / 13, 4 / 13));
		expect(claim).toEqual({kind: 'equation', operands: [2, 3, 4], operators: ['+', '×'], result: 14});
		expect(isEquationTrue({...claim, result: 20})).toBe(false);
	});
	test('false results can be off by one or two in either direction', function() {
		for (const magnitude of [0, 0.99]) {
			for (const direction of [0, 0.99]) {
				const claim = generateEquation('easy', scripted(0.75, 0.5, 0.5, magnitude, direction));
				const offset = magnitude === 0 ? 1 : 2;
				expect(claim.result).toBe(10 + (direction === 0 ? -offset : offset));
				expect(isEquationTrue(claim)).toBe(false);
			}
		}
	});
	test('false zero equations stay nonnegative', function() {
		const claim = generateEquation('hard', scripted(0.75, 0, 0, 0.99, 0, 0));
		expect(claim.result).toBe(1);
	});
	test('medium subtraction has no negative true result', function() {
		const claim = generateEquation('medium', scripted(0, 0, 0.2, 0.99));
		expect(claim).toEqual({kind: 'equation', operands: [4, 4], operators: ['-'], result: 0});
	});
	test('medium addition caps the true sum at twenty', function() {
		const claim = generateEquation('medium', scripted(0, 0.99, 0.99, 0.99));
		expect(claim.result).toBe(20);
	});
	test('medium false sums stay within twenty at the upper boundary', function() {
		for (const magnitude of [0, 0.99]) {
			const claim = generateEquation('medium', scripted(0.75, 0.99, 0.99, 0.99, magnitude, 0.99));
			expect(claim.result).toBe(magnitude === 0 ? 19 : 18);
			expect(isEquationTrue(claim)).toBe(false);
		}
	});
	test('hard also produces two-step sums', function() {
		const claim = generateEquation('hard', scripted(0, 0.99, 0.99, 0.99, 0.99));
		expect(claim).toEqual({kind: 'equation', operands: [10, 10, 10], operators: ['+', '+'], result: 30});
	});
	for (const difficulty of difficulties) {
		test(`${difficulty} keeps operands and answers within its contract`, function() {
			const random = seeded(1234);
			let trueClaims = 0;
			for (let count = 0; count < 200; count++) {
				const claim = generateEquation(difficulty, random);
				const correct = equationValue(claim.operands, claim.operators);
				const delta = Math.abs(claim.result - correct);
				expect([0, 1, 2]).toContain(delta);
				expect(claim.result).toBeGreaterThanOrEqual(0);
				expect(correct).toBeGreaterThanOrEqual(0);
				if (isEquationTrue(claim)) trueClaims++;
				const maxOperand = difficulty === 'easy' ? 9 : difficulty === 'medium' ? 20 : difficulty === 'hard' ? 10 : 12;
				for (const operand of claim.operands) {
					expect(Number.isInteger(operand)).toBe(true);
					expect(operand).toBeGreaterThanOrEqual(0);
					expect(operand).toBeLessThanOrEqual(maxOperand);
				}
				if (difficulty === 'easy') expect(claim.operators).toEqual(['+']);
				if (difficulty === 'medium') {
					expect(correct).toBeLessThanOrEqual(20);
					expect(claim.result).toBeLessThanOrEqual(20);
				}
				if (difficulty === 'insane') expect(claim.operators).toEqual(['+', '×']);
			}
			expect(trueClaims).toBeGreaterThan(70);
			expect(trueClaims).toBeLessThan(130);
		});
	}
	test('predicates reject unrelated payloads', function() {
		const color: StaticPayload = {kind: 'color-word', word: 'red', ink: 'red'};
		const equation: StaticPayload = {kind: 'equation', operands: [1, 2], operators: ['+'], result: 3};
		expect(isEquationTrue(color)).toBe(false);
		expect(isColorWordTrue(equation)).toBe(false);
	});
});
