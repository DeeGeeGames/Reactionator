import {countries, countrySnapshot} from './countries';
import type {Country, CountryModeId, CountryPayload} from './country-types';
import {sample, type Difficulty, type StaticPayload} from './mode';
import {createStaticMode} from './static-challenges';
export const choose = function<T>(items: readonly T[], random: () => number): T {
	const item = items[Math.floor(sample(random) * items.length)];
	if (item === undefined) throw new Error('Empty puzzle pool');
	return item;
};
export const countryClaimTrue = function(payload: CountryPayload): boolean {
	if (payload.question === 'matching-capital') return payload.left.capital === payload.right.capital;
	if (payload.question === 'matching-flag') return payload.left.id === payload.right.id;
	return payload.question === 'larger-population' ? payload.left.population > payload.right.population : payload.left.landAreaKm2 > payload.right.landAreaKm2;
};
export const comparisonPairs = function(question: 'larger-population' | 'larger-land-area', difficulty: Difficulty): readonly (readonly [Country, Country])[] {
	const key = question === 'larger-population' ? 'population' : 'landAreaKm2';
	const ranked = [...countries].sort(function(a, b) { return a[key] - b[key]; });
	return ranked.flatMap(function(a, i) { return ranked.flatMap(function(b, j): readonly (readonly [Country, Country])[] {
		if (a[key] >= b[key]) return [];
		const ratio = b[key] / a[key];
		const eligible = difficulty === 'easy' ? a.familiar && b.familiar && ratio >= 3
			: difficulty === 'medium' ? ratio >= 1.7 && ratio < 3
				: difficulty === 'hard' ? ratio < 1.7 : j === i + 1;
		return eligible ? [[a, b]] : [];
	}); });
};
export const countryMismatchPool = function(left: Country, question: 'matching-capital' | 'matching-flag', difficulty: Difficulty): readonly Country[] {
	return countries.filter(function(right) {
		if (left.id === right.id) return false;
		if (difficulty === 'insane') return (question === 'matching-capital' ? left.capitalConfusions : left.flagConfusions).includes(right.id);
		if (difficulty !== 'easy') return true;
		if (question === 'matching-capital') return left.region !== right.region;
		return left.flag.kind === 'bands' && right.flag.kind === 'bands'
			&& (left.flag.colors.length !== right.flag.colors.length || left.flag.colors[0] !== right.flag.colors[0]);
	});
};
export const generateCountry = function(question: CountryModeId, difficulty: Difficulty, random: () => number): CountryPayload {
	const truth = sample(random) < 0.5;
	if (question === 'larger-population' || question === 'larger-land-area') {
		const [small, large] = choose(comparisonPairs(question, difficulty), random);
		return {kind: 'country', question, left: truth ? large : small, right: truth ? small : large};
	}
	const left = choose(countries, random);
	return {kind: 'country', question, left, right: truth ? left : choose(countryMismatchPool(left, question, difficulty), random)};
};
const names = {
	'matching-capital': ['Matching Capital', 'Press if the city is the capital.'],
	'matching-flag': ['Matching Flag', 'Press if the flag matches the name.'],
	'larger-population': ['Larger Population', 'Press if the population comparison is true.'],
	'larger-land-area': ['Larger Land Area', 'Press if the land-area comparison is true.'],
} as const;
const countryModeIds = ['matching-capital', 'matching-flag', 'larger-population', 'larger-land-area'] as const;
export const countryModes = countryModeIds.map(function(id) {
	return createStaticMode({id, name: names[id][0], prompt: names[id][1],
		generate: function(difficulty, random) { return generateCountry(id, difficulty, random); },
		isTrue: function(payload: StaticPayload) { return payload.kind === 'country' && countryClaimTrue(payload); },
		explain: function(payload) {
			if (payload.kind !== 'country') throw new Error('Expected country');
			const {left, right, question} = payload;
			if (question === 'matching-capital') return {message: `${left.name}’s capital is ${left.capital}. ${right.capital} is ${right.name}’s capital.`};
			if (question === 'matching-flag') return {message: `The flag belongs to ${right.name}. The name says ${left.name}.`};
			const key = question === 'larger-population' ? 'population' : 'landAreaKm2';
			return {message: `${countrySnapshot.populationYear}: ${left.name} ${left[key].toLocaleString('en-US')} ${countryClaimTrue(payload) ? '>' : '<'} ${right.name} ${right[key].toLocaleString('en-US')}${key === 'landAreaKm2' ? ' km² land' : ' people'}.`};
		},
	});
});
