import {award, defineMode, duration, registerMode, sample, validateShared, type CircleAmongSquaresConfig, type CircleStimulus, type Config, type Difficulty, type GlyphCell, type GlyphColor, type GlyphDetail, type Player, type Presentation, type Stimulus} from './mode';

export const circlePrompt = 'Press if you see a circle.';
export const CIRCLE_ACTIVITY_INTERVAL_MS = 320;
const colors: readonly GlyphColor[] = ['coral', 'gold', 'teal', 'blue', 'violet'];
const details: readonly GlyphDetail[] = ['solid', 'stripes', 'dots'];
const boards: Readonly<Record<Difficulty, {readonly columns: number; readonly rows: number; readonly holdMs: number}>> = {
	easy: {columns: 3, rows: 3, holdMs: 5_000},
	medium: {columns: 4, rows: 4, holdMs: 3_500},
	hard: {columns: 5, rows: 4, holdMs: 2_500},
	insane: {columns: 6, rows: 5, holdMs: 1_800},
};
export const circleDefaults: CircleAmongSquaresConfig = {
	mode: 'circle-among-squares', roundMs: 20_000, countdownMs: 3_000,
	gap: [250, 500], difficulty: 'easy',
};
const isCircleConfig = function(config: Config): config is CircleAmongSquaresConfig {
	return config.mode === 'circle-among-squares';
};
const isCircleStimulus = function(state: Stimulus): state is CircleStimulus {
	return state.mode === 'circle-among-squares';
};
const gap = function(time: number, id: number, config: CircleAmongSquaresConfig, random: () => number): CircleStimulus {
	return {mode: 'circle-among-squares', showing: 'gap', id, until: time + duration(config.gap, random), blocked: []};
};
const cellValue = function<T>(values: readonly T[], index: number): T {
	const value = values[index];
	if (value === undefined) throw new Error('Invalid board activity phase');
	return value;
};
const makeCells = function(count: number, phase: number, circleCell: number | null): GlyphCell[] {
	const cells: GlyphCell[] = [];
	for (let index = 0; index < count; index += 1) {
		const color = cellValue(colors, (index + phase) % colors.length);
		const detail = cellValue(details, (index + phase) % details.length);
		cells.push({shape: index === circleCell ? 'circle' : 'square', color, detail});
	}
	return cells;
};
const claim = function(time: number, id: number, config: CircleAmongSquaresConfig, random: () => number, blocked: readonly Player[]): CircleStimulus {
	const board = boards[config.difficulty];
	const count = board.columns * board.rows;
	const circleCell = sample(random) < 0.5 ? Math.floor(sample(random) * count) : null;
	const circleAppearsAt = circleCell === null ? null : time + sample(random) * board.holdMs;
	const circleRevealed = circleCell !== null && circleAppearsAt === time;
	const cells = makeCells(count, 0, circleRevealed ? circleCell : null);
	return {mode: 'circle-among-squares', showing: 'claim', id, until: time + board.holdMs, blocked,
		columns: board.columns, rows: board.rows, activityStartedAt: time, activityPhase: 0,
		cells, circleCell, circleAppearsAt, circleRevealed};
};
const present = function(state: CircleStimulus): Presentation {
	if (state.showing === 'gap') return {kind: 'blank', prompt: circlePrompt};
	return {kind: 'glyphs', prompt: circlePrompt, columns: state.columns, rows: state.rows, cells: state.cells};
};
export const circleAmongSquares = defineMode({
	id: 'circle-among-squares', name: 'Circle among squares',
	defaults: circleDefaults,
	rules: [
		'First eligible press when a circle is on the board: +1.',
		'All squares, or a blank gap: −1. A blank false start also locks you out of the next board.',
		'A miss leaves the board up. Release before pressing again.',
	],
	isConfig: isCircleConfig, isStimulus: isCircleStimulus,
	validate: function(config) {
		const shared = validateShared(config);
		const difficulty = config.difficulty;
		if (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard' && difficulty !== 'insane') throw new Error('Invalid game configuration');
		return {...shared, mode: 'circle-among-squares', difficulty};
	},
	create: gap,
	advance: function(state, time, config, random) {
		if (state.showing === 'gap') {
			if (time < state.until) return state;
			return claim(time, state.id + 1, config, random, state.blocked);
		}
		if (time >= state.until) return gap(time, state.id + 1, config, random);
		const activityPhase = Math.max(0, Math.floor((time - state.activityStartedAt) / CIRCLE_ACTIVITY_INTERVAL_MS));
		const circleRevealed = state.circleRevealed
			|| (state.circleCell !== null && state.circleAppearsAt !== null && time >= state.circleAppearsAt);
		if (activityPhase === state.activityPhase && circleRevealed === state.circleRevealed) return state;
		const cells = makeCells(state.cells.length, activityPhase, circleRevealed ? state.circleCell : null);
		return {...state, cells, activityPhase, circleRevealed};
	},
	press: function(state, {player, time}, config, random) {
		if (state.blocked.includes(player)) return null;
		if (state.showing === 'claim' && state.circleRevealed) return award(state, player, gap(time, state.id + 1, config, random));
		return {stimulus: {...state, blocked: [...state.blocked, player]}, delta: -1, player, identity: state.id};
	},
	present,
});
registerMode(circleAmongSquares);
