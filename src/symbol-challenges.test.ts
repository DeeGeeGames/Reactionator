import {describe, expect, test} from 'bun:test';
import {difficulties, type SymbolKind} from './mode';
import {generateFiveDifferent, generateMatchingPair, generateThreeOfAKind, isFiveDifferentTrue, isMatchingPairTrue, isThreeOfAKindTrue, symbolKinds} from './symbol-challenges';

const repeatedCounts = function(symbols: readonly SymbolKind[]): readonly number[] {
	return symbolKinds.map(function(kind) { return symbols.filter(function(symbol) { return symbol === kind; }).length; })
		.filter(function(count) { return count > 1; });
};
const seeded = function(initial: number): () => number {
	let seed = initial;
	return function() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
};
const claimedRandom = function(truthful: boolean, initial: number): () => number {
	let first = true;
	const random = seeded(initial);
	return function() { if (first) { first = false; return truthful ? 0.1 : 0.8; } return random(); };
};
describe('symbol board generators', function() {
	for (const difficulty of difficulties) {
		for (const truthful of [true, false]) {
			test(`${difficulty} ${truthful ? 'true' : 'false'} boards retain their exact rules across seeds`, function() {
				for (let seed = 1; seed <= 30; seed += 1) {
					const three = generateThreeOfAKind(difficulty, claimedRandom(truthful, seed));
					expect(three.symbols.length).toBe({easy: 4, medium: 6, hard: 8, insane: 10}[difficulty]);
					expect(isThreeOfAKindTrue(three)).toBe(truthful);
					if (!truthful) expect(repeatedCounts(three.symbols).every(function(count) { return count <= 2; })).toBe(true);
					const five = generateFiveDifferent(difficulty, claimedRandom(truthful, seed));
					expect(five.symbols.length).toBe(5);
					expect(isFiveDifferentTrue(five)).toBe(truthful);
					const pair = generateMatchingPair(difficulty, claimedRandom(truthful, seed));
					expect(pair.symbols.length).toBe(difficulty === 'easy' ? 5 : 6);
					expect(isMatchingPairTrue(pair)).toBe(truthful);
					expect(repeatedCounts(pair.symbols)).toEqual(truthful ? [2] : []);
				}
			});
		}
	}
	test('three means at least three and a triple also contains a pair', function() {
		const payload = {kind: 'symbols', symbols: ['circle', 'circle', 'circle', 'circle']} as const;
		expect(isThreeOfAKindTrue(payload)).toBe(true);
		expect(isMatchingPairTrue(payload)).toBe(true);
		expect(isFiveDifferentTrue(payload)).toBe(false);
	});
	test('easy false five has neighboring copies; insane separates similar outlines', function() {
		const easy = generateFiveDifferent('easy', () => 0.9).symbols;
		expect(easy[0]).toBe(easy[1]);
		const insane = generateFiveDifferent('insane', () => 0.9).symbols;
		expect(insane[0]).toBe(insane[4]);
		expect(insane.includes('circle')).toBe(false);
		expect(generateFiveDifferent('insane', () => 0).symbols.includes('circle')).toBe(false);
	});
});
