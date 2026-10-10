export type Player = 1 | 2 | 3 | 4;
export type Color = 'white' | 'red' | 'blue' | 'green';
export const difficulties = ['easy', 'medium', 'hard', 'insane'] as const;
export type Difficulty = typeof difficulties[number];
export type GlyphShape = 'square' | 'circle';
export interface GlyphCell { readonly shape: GlyphShape }
export interface SharedConfig {
	readonly mode: string;
	readonly rounds: number;
	readonly roundMs: number;
	readonly countdownMs: number;
	readonly gap: readonly [number, number];
}
export interface PressOnWhiteConfig extends SharedConfig {
	readonly mode: 'press-on-white';
	readonly appearance: readonly [number, number];
	readonly probabilities: readonly [number, number, number, number];
}
export interface CircleAmongSquaresConfig extends SharedConfig {
	readonly mode: 'circle-among-squares';
	readonly difficulty: Difficulty;
}
export type Config = PressOnWhiteConfig | CircleAmongSquaresConfig;
export interface StimulusCore {
	readonly mode: string;
	readonly id: number;
	readonly until: number;
	readonly blocked: readonly Player[];
}
export interface PressOnWhiteStimulus extends StimulusCore {
	readonly mode: 'press-on-white';
	readonly color: Color | null;
}
export interface CircleGapStimulus extends StimulusCore {
	readonly mode: 'circle-among-squares';
	readonly showing: 'gap';
}
export interface CircleClaimStimulus extends StimulusCore {
	readonly mode: 'circle-among-squares';
	readonly showing: 'claim';
	readonly columns: number;
	readonly rows: number;
	readonly cells: readonly GlyphCell[];
	readonly truthful: boolean;
}
export type CircleStimulus = CircleGapStimulus | CircleClaimStimulus;
export type Stimulus = PressOnWhiteStimulus | CircleStimulus;
export type Presentation =
	| { readonly kind: 'swatch'; readonly color: Color | 'blank'; readonly prompt: string }
	| { readonly kind: 'glyphs'; readonly prompt: string; readonly columns: number; readonly rows: number; readonly cells: readonly GlyphCell[] }
	| { readonly kind: 'blank'; readonly prompt: string };
export interface NormalizedPress { readonly player: Player; readonly time: number }
export interface Outcome {
	readonly stimulus: Stimulus;
	readonly delta: -1 | 1;
	readonly player: Player;
	readonly identity: number;
}
export interface ModeDefinition<TConfig extends Config, TStimulus extends Stimulus> {
	readonly id: TConfig['mode'];
	readonly name: string;
	readonly rules: readonly string[];
	readonly isConfig: (config: Config) => config is TConfig;
	readonly isStimulus: (state: Stimulus) => state is TStimulus;
	readonly validate: (config: TConfig) => TConfig;
	readonly create: (time: number, identity: number, config: TConfig, random: () => number) => TStimulus;
	readonly advance: (state: TStimulus, time: number, config: TConfig, random: () => number) => TStimulus;
	readonly press: (state: TStimulus, press: NormalizedPress, config: TConfig, random: () => number) => Outcome | null;
	readonly present: (state: TStimulus) => Presentation;
}
export interface RuntimeMode {
	readonly id: string;
	readonly name: string;
	readonly rules: readonly string[];
	readonly validate: (config: Config) => Config;
	readonly create: (time: number, identity: number, config: Config, random: () => number) => Stimulus;
	readonly advance: (state: Stimulus, time: number, config: Config, random: () => number) => Stimulus;
	readonly press: (state: Stimulus, press: NormalizedPress, config: Config, random: () => number) => Outcome | null;
	readonly present: (state: Stimulus) => Presentation;
}
const registry = new Map<string, RuntimeMode>();
export const registerMode = function(mode: RuntimeMode): void {
	if (registry.has(mode.id)) throw new Error('Mode already registered');
	registry.set(mode.id, mode);
};
export const requireMode = function(id: string): RuntimeMode {
	const mode = registry.get(id);
	if (mode === undefined) throw new Error('Unknown mode');
	return mode;
};
export const listModes = function(): readonly RuntimeMode[] { return [...registry.values()]; };
export const defineMode = function<TConfig extends Config, TStimulus extends Stimulus>(mode: ModeDefinition<TConfig, TStimulus>): RuntimeMode {
	const configOf = function(config: Config): TConfig {
		if (!mode.isConfig(config)) throw new Error('Mode does not match configuration');
		return config;
	};
	const stimulusOf = function(state: Stimulus): TStimulus {
		if (!mode.isStimulus(state)) throw new Error('Stimulus does not match mode');
		return state;
	};
	return {
		id: mode.id, name: mode.name, rules: mode.rules,
		validate: function(config) { return mode.validate(configOf(config)); },
		create: function(time, identity, config, random) { return mode.create(time, identity, configOf(config), random); },
		advance: function(state, time, config, random) { return mode.advance(stimulusOf(state), time, configOf(config), random); },
		press: function(state, press, config, random) { return mode.press(stimulusOf(state), press, configOf(config), random); },
		present: function(state) { return mode.present(stimulusOf(state)); },
	};
};
const invalid = function(): never { throw new Error('Invalid game configuration'); };
const copyRange = function(range: readonly [number, number]): readonly [number, number] {
	const min = range[0];
	const max = range[1];
	if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) invalid();
	return [min, max];
};
export const validateShared = function(config: SharedConfig): Pick<SharedConfig, 'rounds' | 'roundMs' | 'countdownMs' | 'gap'> {
	if (!Number.isInteger(config.rounds) || config.rounds < 1
		|| !Number.isFinite(config.roundMs) || config.roundMs <= 0
		|| !Number.isFinite(config.countdownMs) || config.countdownMs <= 0) invalid();
	return {rounds: config.rounds, roundMs: config.roundMs, countdownMs: config.countdownMs, gap: copyRange(config.gap)};
};
export const validateConfig = function(config: Config): Config { return requireMode(config.mode).validate(config); };
export const defaults: PressOnWhiteConfig = {
	mode: 'press-on-white', rounds: 5, roundMs: 20_000, countdownMs: 3_000,
	gap: [250, 500], appearance: [700, 1400], probabilities: [0.25, 0.25, 0.25, 0.25],
};
export const roster = function(count: number): readonly Player[] {
	if (count === 2) return [1, 2];
	if (count === 3) return [1, 2, 3];
	if (count === 4) return [1, 2, 3, 4];
	throw new Error('Choose 2, 3, or 4 players');
};
export const sample = function(random: () => number): number {
	const value = random();
	if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Random value must be in [0, 1)');
	return value;
};
export const duration = function(range: readonly [number, number], random: () => number): number {
	return range[0] + sample(random) * (range[1] - range[0]);
};
export const award = function(state: Stimulus, player: Player, next: Stimulus): Outcome {
	return {stimulus: next, delta: 1, player, identity: state.id};
};
const isPressConfig = function(config: Config): config is PressOnWhiteConfig { return config.mode === 'press-on-white'; };
const isPressStimulus = function(state: Stimulus): state is PressOnWhiteStimulus { return state.mode === 'press-on-white'; };
const pressGap = function(time: number, id: number, config: PressOnWhiteConfig, random: () => number): PressOnWhiteStimulus {
	return {mode: 'press-on-white', id, color: null, until: time + duration(config.gap, random), blocked: []};
};
const validatePress = function(config: PressOnWhiteConfig): PressOnWhiteConfig {
	const shared = validateShared(config);
	const appearance = copyRange(config.appearance);
	if (config.probabilities.some(function(probability) { return !Number.isFinite(probability) || probability < 0; })
		|| Math.abs(config.probabilities.reduce(function(sum, probability) { return sum + probability; }, 0) - 1) > 1e-9) invalid();
	return {...shared, mode: 'press-on-white', appearance, probabilities: [...config.probabilities]};
};
export const pressOnWhite: ModeDefinition<PressOnWhiteConfig, PressOnWhiteStimulus> = {
	id: 'press-on-white', name: 'Press on White',
	rules: ['First eligible press on white: +1.', 'Red, blue, green or blank: −1. A blank false start also locks you out of the next color.', 'After white disappears, pressing is wrong. Release before pressing again.'],
	isConfig: isPressConfig, isStimulus: isPressStimulus, validate: validatePress,
	create: pressGap,
	advance: function(state, time, config, random) {
		if (time < state.until) return state;
		if (state.color !== null) return pressGap(time, state.id + 1, config, random);
		const choice = sample(random);
		let cumulative = 0;
		const colors: readonly Color[] = ['white', 'red', 'blue', 'green'];
		let color: Color = 'green';
		for (const [index, probability] of config.probabilities.entries()) {
			cumulative += probability;
			const candidate = colors[index];
			if (choice < cumulative && candidate !== undefined) { color = candidate; break; }
		}
		return {mode: 'press-on-white', id: state.id + 1, color, until: time + duration(config.appearance, random), blocked: state.blocked};
	},
	press: function(state, {player, time}, config, random) {
		if (state.blocked.includes(player)) return null;
		if (state.color === 'white') return award(state, player, pressGap(time, state.id + 1, config, random));
		return {stimulus: {...state, blocked: [...state.blocked, player]}, delta: -1, player, identity: state.id};
	},
	present: function(state) { return {kind: 'swatch', color: state.color ?? 'blank', prompt: ''}; },
};
registerMode(defineMode(pressOnWhite));
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
