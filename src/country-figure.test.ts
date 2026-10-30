import {expect, test} from 'bun:test';
import {countries, validateCountries} from './countries';
import {comparisonPairs, countryClaimTrue, countryMismatchPool, countryModes, generateCountry} from './country-challenges';
import {figureClaimTrue, figureModes, figurePool, generateFigures, pandaGrids} from './figure-challenges';
import {figures, validateFigures} from './silhouettes';
import {difficulties} from './mode';
import type {CountryModeId} from './country-types';
import type {FigureModeId, FigureTag} from './figure-types';
const random = function(seed: number): () => number { let state = seed; return function() { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; };
const countryIds: readonly CountryModeId[] = ['matching-capital', 'matching-flag', 'larger-population', 'larger-land-area'];
const figureIds: readonly FigureModeId[] = ['animal-silhouette', 'flying-silhouette', 'made-by-people', 'panda-in-group'];
test('pinned facts and malformed snapshots', function() {
	expect(countries.length).toBeGreaterThanOrEqual(24);
	for (const [id, capital, population, area] of [['fra', 'Paris', 68372286, 538950], ['deu', 'Berlin', 83287273, 349430], ['ita', 'Rome', 58984216, 295720]] as const) {
		const row = countries.find(function(c) { return c.id === id; });
		expect(row?.capital).toBe(capital); expect(row?.population).toBe(population); expect(row?.landAreaKm2).toBe(area);
	}
	const france = countries.find(function(c) { return c.id === 'fra'; }); const germany = countries.find(function(c) { return c.id === 'deu'; });
	if (!france || !germany) throw new Error('Missing fixtures');
	expect(countryClaimTrue({kind: 'country', question: 'matching-capital', left: france, right: germany})).toBe(false);
	for (const invalid of [[france, france], [{...france, population: NaN}], [{...france, landAreaKm2: 2.5}], [{...france, flag: {kind: 'invalid'}}]]) expect(function() { validateCountries(invalid); }).toThrow();
});
for (const difficulty of difficulties) {
	for (const question of countryIds) test(`${question} ${difficulty} has balanced independently judged seeded claims`, function() {
		const rng = random(912); let truths = 0;
		for (let i = 0; i < 200; i++) {
			const p = generateCountry(question, difficulty, rng);
			const truth = question === 'matching-capital' ? p.left.capital === p.right.capital : question === 'matching-flag' ? p.left.id === p.right.id
				: question === 'larger-population' ? p.left.population > p.right.population : p.left.landAreaKm2 > p.right.landAreaKm2;
			expect(countryClaimTrue(p)).toBe(truth); truths += Number(truth);
		}
		expect(truths).toBeGreaterThan(60); expect(truths).toBeLessThan(140);
		if (question === 'matching-capital' || question === 'matching-flag') for (const c of countries) {
			const pool = countryMismatchPool(c, question, difficulty); expect(pool.length).toBeGreaterThan(0);
			if (difficulty === 'easy' && question === 'matching-capital') expect(pool.every(function(other) { return other.region !== c.region; })).toBe(true);
		} else expect(comparisonPairs(question, difficulty).length).toBeGreaterThan(0);
	});
	for (const question of figureIds) test(`${question} ${difficulty} seeded tags and dimensions`, function() {
		const rng = random(72); let truths = 0;
		for (let i = 0; i < 150; i++) {
			const p = generateFigures(question, difficulty, rng); truths += Number(figureClaimTrue(p));
			if (question === 'panda-in-group') { expect([p.columns, p.rows]).toEqual([...pandaGrids[difficulty]]); expect(p.figures.length).toBe(p.columns * p.rows); expect(p.figures.filter(function(f) { return f.id === 'panda'; }).length).toBeLessThanOrEqual(1); }
		}
		expect(truths).toBeGreaterThan(40); expect(truths).toBeLessThan(110);
	});
	for (const tag of ['animal', 'canFly', 'madeByPeople'] as const) for (const truth of [true, false]) expect(figurePool(tag, difficulty, truth).length).toBeGreaterThan(0);
}
test('every original figure has independently expected classification tags', function() {
	const expected: Readonly<Record<FigureTag, readonly string[]>> = {animal: ['sparrow','butterfly','bat','dog','cat','fish','panda','rabbit','bear'], canFly: ['sparrow','butterfly','bat','plane','helicopter'], madeByPeople: ['plane','helicopter','hammer','cup','chair','bicycle']};
	expect(figures.length).toBeGreaterThanOrEqual(16);
	const questions = {animal: 'animal-silhouette', canFly: 'flying-silhouette', madeByPeople: 'made-by-people'} as const;
	for (const figure of figures) for (const tag of ['animal', 'canFly', 'madeByPeople'] as const) {
		const truth = expected[tag].includes(figure.id);
		expect(figure[tag]).toBe(truth);
		expect(figureClaimTrue({kind: 'figures', question: questions[tag], columns: 1, rows: 1, figures: [figure]})).toBe(truth);
	}
	expect(function() { validateFigures([...figures, ...figures]); }).toThrow();
});
test('panda can occupy every cell; multiple targets count and ordinary bear does not', function() {
	const panda = figures.find(function(f) { return f.id === 'panda'; }); const bear = figures.find(function(f) { return f.id === 'bear'; });
	if (!panda || !bear) throw new Error('Missing fixtures');
	for (const difficulty of difficulties) {
		const [columns, rows] = pandaGrids[difficulty];
		for (let cell = 0; cell < columns * rows; cell++) {
			let call = 0;
			const p = generateFigures('panda-in-group', difficulty, function() { call++; return call === 1 ? 0 : call === 2 ? (cell + 0.5) / (columns * rows) : 0.2; });
			expect(p.figures[cell]?.id).toBe('panda'); expect(figureClaimTrue(p)).toBe(true);
		}
	}
	for (const animals of [[panda,panda], [bear,bear]]) expect(figureClaimTrue({kind: 'figures', question: 'panda-in-group', columns: 2, rows: 1, figures: animals})).toBe(animals[0]?.id === 'panda');
});
test('all eight selectable modes have typed defaults', function() { expect([...countryModes, ...figureModes].length).toBe(8); });
