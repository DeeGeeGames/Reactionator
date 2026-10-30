import {sample} from '../mode';
export const pick = function<T>(values: readonly T[], random: () => number): T {
	const value = values[Math.floor(sample(random) * values.length)];
	if (value === undefined) throw new Error('Empty pool');
	return value;
};
export const integer = function(max: number, random: () => number): number { return Math.floor(sample(random) * max); };
export const shuffle = function<T>(values: readonly T[], random: () => number): readonly T[] {
	const result = [...values];
	for (let i = result.length - 1; i > 0; i--) {
		const j = integer(i + 1, random);
		const a = result[i]; const b = result[j];
		if (a === undefined || b === undefined) throw new Error('Missing shuffle entry');
		result[i] = b; result[j] = a;
	}
	return result;
};
