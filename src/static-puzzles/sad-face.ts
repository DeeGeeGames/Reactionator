import {award, defineMode, difficulties, duration, validateShared, type Config, type StaticClaimStimulus, type StaticConfig, type Stimulus} from '../mode';
import {staticDefaults} from '../static-challenges';
import type {SadFacePuzzle} from './contracts';
import {changeFaces, createFaces} from './faces';
import {explainPuzzle, puzzleIsTrue} from './rules';

interface SadFaceStimulus extends StaticClaimStimulus {
	readonly mode: 'sad-face';
	readonly payload: {readonly kind: 'static-puzzle'; readonly puzzle: SadFacePuzzle};
}

const freshRun = function(time: number, id: number, random: () => number): SadFaceStimulus {
	return {mode: 'sad-face', showing: 'claim', id, blocked: [],
		payload: {kind: 'static-puzzle', puzzle: createFaces(random)}, until: time + duration([500, 2000], random)};
};

export const sadFace = defineMode<StaticConfig, SadFaceStimulus>({
	id: 'sad-face', name: 'Sad Face', defaults: staticDefaults('sad-face'),
	rules: ['Press if a face is sad.', 'Every run starts happy. Faces turn instantly at random intervals.',
		'First eligible correct press: +1, followed by a 2-second answer reveal.',
		'Wrong press: −1 once per run. Release before pressing again.'],
	isConfig: function(config: Config): config is StaticConfig { return config.mode === 'sad-face'; },
	isStimulus: function(state: Stimulus): state is SadFaceStimulus {
		return state.mode === 'sad-face' && 'payload' in state && state.payload.kind === 'static-puzzle' && state.payload.puzzle.type === 'sad-face';
	},
	validate: function(config) {
		if (!difficulties.includes(config.difficulty)) throw new Error('Invalid difficulty');
		return {...config, ...validateShared(config)};
	},
	create: function(time, id, _config, random) { return freshRun(time, id, random); },
	advance: function(state, time, _config, random) {
		if (time < state.until) return state;
		// Commit one visible change after a delayed frame, without replaying unseen targets.
		return {...state, id: state.id + 1, payload: {kind: 'static-puzzle', puzzle: changeFaces(state.payload.puzzle, random)},
			until: time + duration([500, 2000], random)};
	},
	press: function(state, {player, time, players}, _config, random) {
		if (state.blocked.includes(player)) return null;
		if (puzzleIsTrue(state.payload.puzzle)) return award(state, player, freshRun(time, state.id + 1, random));
		const blocked = [...state.blocked, player];
		const exhausted = players !== undefined && players.every(function(candidate) { return blocked.includes(candidate); });
		return {stimulus: exhausted ? freshRun(time, state.id + 1, random) : {...state, blocked}, delta: -1, player, identity: state.id};
	},
	present: function(state) { return {kind: 'static-puzzle', prompt: 'Press if a face is sad.', puzzle: state.payload.puzzle}; },
	explain: function(state) { return explainPuzzle(state.payload.puzzle); },
});
