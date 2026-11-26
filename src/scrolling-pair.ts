import {award, defineMode, difficulties, validateShared, type Config, type Difficulty, type ScrollingSymbol, type StaticClaimStimulus, type StaticConfig, type Stimulus, type SymbolKind} from './mode';
import {staticDefaults} from './static-challenges';
import {shuffle} from './static-puzzles/random';
import {symbolNames} from './symbol-art';

export const scrollingIconWidth = 22;
export const scrollingSpacing = 30;
export const scrollingSpeeds: Readonly<Record<Difficulty, number>> = {easy: 9, medium: 12, hard: 15, insane: 19};
export type ScrollingRows = readonly [readonly SymbolKind[], readonly SymbolKind[]];
export interface ScrollingPairStimulus extends StaticClaimStimulus {
	readonly mode: 'matching-pair';
	readonly payload: {readonly kind: 'symbols'; readonly symbols: readonly SymbolKind[]};
	readonly rows: ScrollingRows;
	readonly items: readonly ScrollingSymbol[];
}

export const commitScrollingRows = function(rows: ScrollingRows, speed: number, elapsed: number): readonly ScrollingSymbol[] {
	return rows.flatMap(function(strip, row) {
		if (strip.length < 5 || (row !== 0 && row !== 1)) throw new Error('Invalid scrolling row');
		const period = strip.length * scrollingSpacing;
		const shift = Math.max(0, elapsed) * speed / 1000 * (row === 0 ? -1 : 1);
		return strip.flatMap(function(kind, index): readonly ScrollingSymbol[] {
			const position = 20 + index * scrollingSpacing + shift;
			const x = ((position + scrollingSpacing) % period + period) % period - scrollingSpacing;
			const half = scrollingIconWidth / 2;
			if (x + half <= 0 || x - half >= 100) return [];
			return [{id: `${row}:${index}`, row, kind, artIndex: index, x, fullyVisible: x - half >= 0 && x + half <= 100}];
		});
	});
};
const fullyVisible = function(items: readonly ScrollingSymbol[]): readonly ScrollingSymbol[] {
	return items.filter(function(item) { return item.fullyVisible; });
};
export const hasScrollingPair = function(items: readonly ScrollingSymbol[]): boolean {
	const kinds = fullyVisible(items).map(function(item) { return item.kind; });
	return new Set(kinds).size < kinds.length;
};
const signature = function(items: readonly ScrollingSymbol[]): string {
	return fullyVisible(items).map(function(item) { return item.id; }).join(',');
};

export const createScrollingPairMode = function(kinds: readonly SymbolKind[]) {
	if (kinds.length < 6) throw new Error('Matching Pair needs a varied object pool');
	const freshRun = function(time: number, id: number, config: StaticConfig, random: () => number): ScrollingPairStimulus {
		const deck = [...kinds, ...kinds];
		const rows: ScrollingRows = [shuffle(deck, random), shuffle(deck, random)];
		const items = commitScrollingRows(rows, scrollingSpeeds[config.difficulty], 0);
		// The runner shifts until by its reveal duration, keeping the new reels at
		// their starting positions until the old answer has finished displaying.
		return {mode: 'matching-pair', showing: 'claim', id, blocked: [], rows, items, until: time + config.roundMs,
			payload: {kind: 'symbols', symbols: fullyVisible(items).map(function(item) { return item.kind; })}};
	};
	return defineMode<StaticConfig, ScrollingPairStimulus>({
		id: 'matching-pair', name: 'Matching Pair', defaults: staticDefaults('matching-pair'),
		rules: ['Press when two fully visible objects match.', 'The two rows scroll in opposite directions.',
			'First eligible correct press: +1, followed by a 2-second answer reveal.',
			'Wrong press: −1 once until the visible objects change. Release before pressing again.'],
		isConfig: function(config: Config): config is StaticConfig { return config.mode === 'matching-pair'; },
		isStimulus: function(state: Stimulus): state is ScrollingPairStimulus {
			return state.mode === 'matching-pair' && 'payload' in state && state.payload.kind === 'symbols'
				&& 'rows' in state && Array.isArray(state.rows) && 'items' in state && Array.isArray(state.items);
		},
		validate: function(config) {
			if (!difficulties.includes(config.difficulty)) throw new Error('Invalid difficulty');
			return {...config, ...validateShared(config)};
		},
		create: freshRun,
		advance: function(state, time, config) {
			const elapsed = Math.max(0, time - (state.until - config.roundMs));
			const items = commitScrollingRows(state.rows, scrollingSpeeds[config.difficulty], elapsed);
			const changed = signature(items) !== signature(state.items);
			return {...state, items, id: state.id + (changed ? 1 : 0), blocked: changed ? [] : state.blocked,
				payload: {kind: 'symbols', symbols: fullyVisible(items).map(function(item) { return item.kind; })}};
		},
		press: function(state, {player, time}, config, random) {
			if (state.blocked.includes(player)) return null;
			if (hasScrollingPair(state.items)) return award(state, player, freshRun(time, state.id + 1, config, random));
			return {stimulus: {...state, blocked: [...state.blocked, player]}, delta: -1, player, identity: state.id};
		},
		present: function(state) { return {kind: 'scrolling-symbols', prompt: 'Press when two fully visible objects match.', items: state.items}; },
		explain: function(state) {
			const seen = new Map<SymbolKind, number>();
			for (const [index, kind] of state.payload.symbols.entries()) {
				const previous = seen.get(kind);
				if (previous !== undefined) return {message: `These two ${symbolNames[kind].plural} match.`, highlightedSymbols: [previous, index]};
				seen.set(kind, index);
			}
			return {message: 'Every fully visible object is different.'};
		},
	});
};
