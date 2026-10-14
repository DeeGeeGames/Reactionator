import {award, defineMode, difficulties, duration, validateShared, type Config, type Difficulty, type Presentation, type RuntimeMode, type StaticConfig, type StaticModeId, type StaticPayload, type StaticStimulus, type Stimulus} from './mode';

export const claimHoldMs: Readonly<Record<Difficulty, number>> = {
	easy: 5_000, medium: 3_500, hard: 2_500, insane: 1_800,
};
export const staticDefaults = function(mode: StaticModeId): StaticConfig {
	return {mode, difficulty: 'easy', roundMs: 20_000, countdownMs: 3_000, gap: [250, 500]};
};
interface StaticModeOptions {
	readonly id: StaticModeId;
	readonly name: string;
	readonly prompt: string;
	readonly generate: (difficulty: Difficulty, random: () => number) => StaticPayload;
	readonly isTrue: (payload: StaticPayload) => boolean;
}
const payloadPresentation = function(payload: StaticPayload, prompt: string): Presentation {
	if (payload.kind === 'symbols') return {kind: 'symbols', prompt, symbols: payload.symbols};
	if (payload.kind === 'color-word') return {kind: 'text', prompt, text: payload.word.toUpperCase(), ink: payload.ink};
	const first = payload.operands[0];
	if (first === undefined || payload.operands.length !== payload.operators.length + 1) throw new Error('Invalid equation presentation');
	const terms = payload.operators.map(function(operator, index) {
		const operand = payload.operands[index + 1];
		if (operand === undefined) throw new Error('Missing equation operand');
		return `${operator} ${operand}`;
	});
	return {kind: 'text', prompt, text: `${first} ${terms.join(' ')} = ${payload.result}`};
};
export const createStaticMode = function(options: StaticModeOptions): RuntimeMode {
	const gap = function(time: number, id: number, config: StaticConfig, random: () => number): StaticStimulus {
		return {mode: options.id, showing: 'gap', id, until: time + duration(config.gap, random), blocked: []};
	};
	return defineMode<StaticConfig, StaticStimulus>({
		id: options.id, name: options.name, defaults: staticDefaults(options.id),
		rules: [
			options.prompt,
			'First eligible correct press: +1 and a fresh blank gap.',
			'Wrong claim or blank gap: −1 once per player. A blank false start also blocks the next claim.',
			'Missing a claim costs nothing. Release before pressing again.',
		],
		isConfig: function(config: Config): config is StaticConfig { return config.mode === options.id; },
		isStimulus: function(state: Stimulus): state is StaticStimulus { return state.mode === options.id; },
		validate: function(config) {
			if (!difficulties.includes(config.difficulty)) throw new Error('Invalid game configuration');
			return {...validateShared(config), mode: options.id, difficulty: config.difficulty};
		},
		create: gap,
		advance: function(state, time, config, random) {
			if (time < state.until) return state;
			if (state.showing === 'claim') return gap(time, state.id + 1, config, random);
			return {mode: options.id, showing: 'claim', id: state.id + 1, until: time + claimHoldMs[config.difficulty],
				blocked: state.blocked, payload: options.generate(config.difficulty, random)};
		},
		press: function(state, {player, time}, config, random) {
			if (state.blocked.includes(player)) return null;
			if (state.showing === 'claim' && options.isTrue(state.payload)) return award(state, player, gap(time, state.id + 1, config, random));
			return {stimulus: {...state, blocked: [...state.blocked, player]}, delta: -1, player, identity: state.id};
		},
		present: function(state) {
			return state.showing === 'gap' ? {kind: 'blank', prompt: options.prompt} : payloadPresentation(state.payload, options.prompt);
		},
	});
};
