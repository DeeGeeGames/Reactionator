export type Player = 1 | 2 | 3 | 4;
export type Color = 'white' | 'red' | 'blue' | 'green';
export interface Config {
	readonly mode: 'press-on-white';
	readonly rounds: number;
	readonly roundMs: number;
	readonly countdownMs: number;
	readonly gap: readonly [number, number];
	readonly appearance: readonly [number, number];
	readonly probabilities: readonly [number, number, number, number];
}
export const defaults: Config = {
	mode: 'press-on-white', rounds: 5, roundMs: 20_000, countdownMs: 3_000,
	gap: [250, 500], appearance: [700, 1400], probabilities: [0.25, 0.25, 0.25, 0.25],
};
export const validateConfig = function(config: Config): Config {
	const ranges = [config.gap, config.appearance];
	if (config.mode !== 'press-on-white' || !Number.isInteger(config.rounds) || config.rounds < 1
		|| !Number.isFinite(config.roundMs) || config.roundMs <= 0
		|| !Number.isFinite(config.countdownMs) || config.countdownMs <= 0
		|| ranges.some(([min, max]) => !Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min)
		|| config.probabilities.some(p => !Number.isFinite(p) || p < 0)
		|| Math.abs(config.probabilities.reduce((sum, p) => sum + p, 0) - 1) > 1e-9) {
		throw new Error('Invalid game configuration');
	}
	return {...config, gap: [...config.gap], appearance: [...config.appearance], probabilities: [...config.probabilities]};
};
export const roster = function(count: number): readonly Player[] {
	if (count === 2) return [1, 3];
	if (count === 3) return [1, 2, 3];
	if (count === 4) return [1, 2, 3, 4];
	throw new Error('Choose 2, 3, or 4 players');
};
export interface Stimulus {
	readonly id: number;
	readonly color: Color | null;
	readonly until: number;
	readonly blocked: readonly Player[];
}
export interface NormalizedPress {
	readonly player: Player;
	readonly time: number;
}
export interface Outcome {
	readonly stimulus: Stimulus;
	readonly delta: -1 | 1;
	readonly player: Player;
	readonly identity: number;
}
export interface ModeDefinition {
	readonly id: Config['mode'];
	readonly name: string;
	readonly rules: readonly string[];
	readonly create: (time: number, identity: number, config: Config, random: () => number) => Stimulus;
	readonly advance: (state: Stimulus, time: number, config: Config, random: () => number) => Stimulus;
	readonly press: (state: Stimulus, press: NormalizedPress, config: Config, random: () => number) => Outcome | null;
}
const sample = function(random: () => number): number {
	const value = random();
	if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Random value must be in [0, 1)');
	return value;
};
const duration = function(range: readonly [number, number], random: () => number): number {
	return range[0] + sample(random) * (range[1] - range[0]);
};
const gap = function(time: number, id: number, config: Config, random: () => number): Stimulus {
	return {id, color: null, until: time + duration(config.gap, random), blocked: []};
};
export const pressOnWhite: ModeDefinition = {
	id: 'press-on-white', name: 'Press on White',
	rules: ['First eligible press on white: +1.', 'Red, blue, green or blank: −1. A blank false start also locks you out of the next color.', 'After white disappears, pressing is wrong. Release before pressing again.'],
	create: gap,
	advance: function(state, time, config, random) {
		if (time < state.until) return state;
		if (state.color !== null) return gap(time, state.id + 1, config, random);
		const choice = sample(random);
		let cumulative = 0;
		const colors: readonly Color[] = ['white', 'red', 'blue', 'green'];
		let color: Color = 'green';
		for (const [index, probability] of config.probabilities.entries()) {
			cumulative += probability;
			const candidate = colors[index];
			if (choice < cumulative && candidate !== undefined) { color = candidate; break; }
		}
		return {id: state.id + 1, color, until: time + duration(config.appearance, random), blocked: state.blocked};
	},
	press: function(state, {player, time}, config, random) {
		if (state.blocked.includes(player)) return null;
		if (state.color === 'white') return {stimulus: gap(time, state.id + 1, config, random), delta: 1, player, identity: state.id};
		return {stimulus: {...state, blocked: [...state.blocked, player]}, delta: -1, player, identity: state.id};
	},
};
export interface ScoreEvent { readonly id: string; readonly player: Player; readonly delta: -1 | 1 }
export interface Scores {
	readonly round: Readonly<Record<Player, number>>;
	readonly total: Readonly<Record<Player, number>>;
	readonly applied: ReadonlySet<string>;
}
export const emptyScores = function(): Scores {
	return {round: {1: 0, 2: 0, 3: 0, 4: 0}, total: {1: 0, 2: 0, 3: 0, 4: 0}, applied: new Set()};
};
export const reduceScore = function(scores: Scores, event: ScoreEvent, players: readonly Player[]): Scores {
	if (!event.id || !players.includes(event.player) || (event.delta !== -1 && event.delta !== 1)) throw new Error('Invalid score event');
	if (scores.applied.has(event.id)) return scores;
	return {round: {...scores.round, [event.player]: scores.round[event.player] + event.delta},
		total: {...scores.total, [event.player]: scores.total[event.player] + event.delta}, applied: new Set([...scores.applied, event.id])};
};
