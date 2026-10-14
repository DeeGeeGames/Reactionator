import {sample, type Difficulty, type StaticPayload, type SymbolKind} from './mode';
import {createStaticMode} from './static-challenges';

type SymbolsPayload = Extract<StaticPayload, {kind: 'symbols'}>;
export const symbolKinds: readonly SymbolKind[] = ['circle', 'square', 'triangle', 'diamond', 'star', 'pentagon'];
const threeCounts: Readonly<Record<Difficulty, number>> = {easy: 4, medium: 6, hard: 8, insane: 10};
const valueAt = function<T>(values: readonly T[], index: number): T {
	const value = values[index];
	if (value === undefined) throw new Error('Missing symbol');
	return value;
};
const shuffled = function<T>(values: readonly T[], random: () => number): readonly T[] {
	const result = [...values];
	for (let index = result.length - 1; index > 0; index -= 1) {
		const other = Math.floor(sample(random) * (index + 1));
		const current = valueAt(result, index);
		result[index] = valueAt(result, other);
		result[other] = current;
	}
	return result;
};
const counts = function(symbols: readonly SymbolKind[]): readonly number[] {
	return symbolKinds.map(function(kind) { return symbols.filter(function(symbol) { return symbol === kind; }).length; });
};
export const isThreeOfAKindTrue = function(payload: StaticPayload): boolean {
	return payload.kind === 'symbols' && counts(payload.symbols).some(function(count) { return count >= 3; });
};
export const isFiveDifferentTrue = function(payload: StaticPayload): boolean {
	return payload.kind === 'symbols' && payload.symbols.length === 5 && new Set(payload.symbols).size === 5;
};
export const isMatchingPairTrue = function(payload: StaticPayload): boolean {
	return payload.kind === 'symbols' && counts(payload.symbols).some(function(count) { return count >= 2; });
};
export const generateThreeOfAKind = function(difficulty: Difficulty, random: () => number): SymbolsPayload {
	const truthful = sample(random) < 0.5;
	const kinds = shuffled(symbolKinds, random);
	const count = threeCounts[difficulty];
	const first = valueAt(kinds, 0);
	const symbols = truthful
		? [first, first, first, ...[...kinds.slice(1), ...kinds.slice(1)].slice(0, count - 3)]
		: [...kinds, ...kinds].slice(0, count);
	return {kind: 'symbols', symbols: shuffled(symbols, random)};
};
const pairPlacement = function(symbols: readonly SymbolKind[], duplicate: SymbolKind, difficulty: Difficulty): readonly SymbolKind[] {
	// Every board uses the same row layout. Only symbol order varies by difficulty.
	if (difficulty === 'easy') return [duplicate, duplicate, ...symbols];
	if (difficulty === 'medium') return [duplicate, ...symbols.slice(0, 1), duplicate, ...symbols.slice(1)];
	return [duplicate, ...symbols, duplicate];
};
export const generateFiveDifferent = function(difficulty: Difficulty, random: () => number): SymbolsPayload {
	const truthful = sample(random) < 0.5;
	// Both insane board types use the same polygon pool; shape choice must not reveal truth.
	const pool = difficulty === 'insane'
		? symbolKinds.filter(function(kind) { return kind !== 'circle'; }) : symbolKinds;
	const kinds = shuffled(pool, random);
	if (truthful) return {kind: 'symbols', symbols: kinds.slice(0, 5)};
	return {kind: 'symbols', symbols: pairPlacement(kinds.slice(1, 4), valueAt(kinds, 0), difficulty)};
};
export const generateMatchingPair = function(difficulty: Difficulty, random: () => number): SymbolsPayload {
	const truthful = sample(random) < 0.5;
	const kinds = shuffled(symbolKinds, random);
	const count = difficulty === 'easy' ? 5 : 6;
	return {kind: 'symbols', symbols: truthful
		? pairPlacement(kinds.slice(1, count - 1), valueAt(kinds, 0), difficulty)
		: kinds.slice(0, count)};
};
export const threeOfAKind = createStaticMode({
	id: 'three-of-a-kind', name: 'Three of a Kind', prompt: 'Press if three match.',
	generate: generateThreeOfAKind, isTrue: isThreeOfAKindTrue,
});
export const fiveDifferent = createStaticMode({
	id: 'five-different', name: 'Five Different', prompt: 'Press if all five differ.',
	generate: generateFiveDifferent, isTrue: isFiveDifferentTrue,
});
export const matchingPair = createStaticMode({
	id: 'matching-pair', name: 'Matching Pair', prompt: 'Press if a pair is showing.',
	generate: generateMatchingPair, isTrue: isMatchingPairTrue,
});
