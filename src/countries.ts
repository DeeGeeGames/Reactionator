import snapshot from './country-snapshot.json';
import type {Country, Flag} from './country-types';
export const countrySnapshot = {
	version: 'wdi-2023-v1', populationYear: 2023, landAreaYear: 2023, retrieved: '2026-10-29',
	populationDefinition: 'De facto mid-year population: all residents regardless of legal status or citizenship.',
	landAreaDefinition: 'Land excluding inland waters, continental shelf claims and exclusive economic zones; rounded to whole square kilometres.',
	populationSource: 'https://databank.worldbank.org/metadataglossary/world-development-indicators/series/SP.POP.TOTL',
	landAreaSource: 'https://databank.worldbank.org/metadataglossary/world-development-indicators/series/AG.LND.TOTL.K2',
} as const;
const record = function(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; };
const text = function(value: unknown): string { if (typeof value !== 'string' || value.length === 0) throw new Error('Invalid country text'); return value; };
const strings = function(value: unknown): readonly string[] { if (!Array.isArray(value)) throw new Error('Invalid list'); return value.map(text); };
const positive = function(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error('Invalid country number'); return value; };
const flag = function(value: unknown): Flag {
	if (!record(value) || value.kind !== 'bands' || (value.axis !== 'horizontal' && value.axis !== 'vertical')) throw new Error('Invalid flag');
	const colors = strings(value.colors);
	if (colors.length < 2 || colors.some(function(color) { return !/^#[a-f0-9]{3}([a-f0-9]{3})?$/i.test(color); })) throw new Error('Invalid flag bands');
	return {kind: 'bands', axis: value.axis, ratio: positive(value.ratio), colors};
};
export const validateCountries = function(value: unknown): readonly Country[] {
	if (!Array.isArray(value)) throw new Error('Invalid country snapshot');
	const seen = new Set<string>();
	const countries = value.map(function(row: unknown): Country {
		if (!record(row) || !record(row.sources) || typeof row.familiar !== 'boolean') throw new Error('Invalid country');
		const id = text(row.id);
		if (seen.has(id)) throw new Error('Duplicate country');
		seen.add(id);
		const population = positive(row.population); const landAreaKm2 = positive(row.landAreaKm2);
		if (!Number.isSafeInteger(population) || !Number.isSafeInteger(landAreaKm2)) throw new Error('Snapshot requires whole numbers');
		return {id, name: text(row.name), capital: text(row.capital), region: text(row.region), familiar: row.familiar,
			population, landAreaKm2, flag: flag(row.flag), capitalConfusions: strings(row.capitalConfusions), flagConfusions: strings(row.flagConfusions),
			sources: {names: text(row.sources.names), population: text(row.sources.population), landAreaKm2: text(row.sources.landAreaKm2), flag: text(row.sources.flag)}};
	});
	for (const country of countries) for (const id of [...country.capitalConfusions, ...country.flagConfusions]) {
		if (!seen.has(id) || id === country.id) throw new Error('Invalid confusion reference');
	}
	return countries;
};
export const countries = validateCountries(snapshot);
