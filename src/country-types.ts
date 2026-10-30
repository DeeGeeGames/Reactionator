export type CountryModeId = 'matching-capital' | 'matching-flag' | 'larger-population' | 'larger-land-area';
export type Flag =
	| {readonly kind: 'bands'; readonly axis: 'horizontal' | 'vertical'; readonly colors: readonly string[]; readonly ratio: number}
	| {readonly kind: 'cross'; readonly background: string; readonly color: string; readonly ratio: number; readonly x: number; readonly width: number};
export interface Country {
	readonly id: string;
	readonly name: string;
	readonly capital: string;
	readonly region: string;
	readonly population: number;
	readonly landAreaKm2: number;
	readonly familiar: boolean;
	readonly capitalConfusions: readonly string[];
	readonly flagConfusions: readonly string[];
	readonly flag: Flag;
	readonly sources: {readonly names: string; readonly population: string; readonly landAreaKm2: string; readonly flag: string};
}
export interface CountryPayload {
	readonly kind: 'country';
	readonly question: CountryModeId;
	readonly left: Country;
	readonly right: Country;
}
export interface CountryPresentation {readonly kind: 'country'; readonly prompt: string; readonly payload: CountryPayload}
