import {award, defineMode, difficulties, duration, sample, validateShared, type Config, type Difficulty, type RuntimeMode, type Stimulus} from './mode';
import {claimHoldMs} from './static-challenges';
import {cornerFrames, mouseGraph, reachable} from './maze-graphs';
import type {MovingCircle, PathTimeConfig, PathTimeDrawing, PathTimeId, PathTimePlan, PathTimeStimulus} from './path-time-types';
export const pathTimeIds: readonly PathTimeId[] = ['mouse-to-cheese', 'countdown-to-zero', 'colliding-shapes', 'corner-to-corner'];
export const pathTimeDefaults = function(mode: PathTimeId, difficulty: Difficulty = 'easy'): PathTimeConfig {
	return {mode, difficulty, roundMs: 20_000, countdownMs: 3_000, gap: [250, 500]};
};
// All timing and density presets are provisional web designs pending owner/device acceptance.
export const temporalPresets: Readonly<Record<Difficulty, {readonly startDigit: number; readonly speed: number; readonly overlapMs: number; readonly mazeHoldMs: number; readonly mouseHoldMs: number}>> = {
	easy: {startDigit: 3, speed: 25, overlapMs: 650, mazeHoldMs: 12_000, mouseHoldMs: 8_000},
	medium: {startDigit: 5, speed: 35, overlapMs: 450, mazeHoldMs: 11_000, mouseHoldMs: 9_000},
	hard: {startDigit: 7, speed: 45, overlapMs: 300, mazeHoldMs: 10_000, mouseHoldMs: 10_000},
	insane: {startDigit: 7, speed: 60, overlapMs: 200, mazeHoldMs: 9_000, mouseHoldMs: 12_000},
};
export const overlapping = function(circles: readonly [MovingCircle, MovingCircle]): boolean {
	const [a, b] = circles;
	return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < (a.radius + b.radius) ** 2;
};
export const drawingTrue = function(drawing: PathTimeDrawing): boolean {
	if (drawing.kind === 'countdown') return drawing.digit === 0;
	if (drawing.kind === 'collision') return overlapping(drawing.circles);
	return reachable(drawing.graph);
};
export const commitDrawing = function(plan: PathTimePlan, elapsed: number): PathTimeDrawing {
	if (plan.kind === 'countdown') return {kind: 'countdown', digit: Math.max(0, plan.startDigit - Math.floor(elapsed * (plan.startDigit + 1) / plan.holdMs))};
	if (plan.kind === 'collision') {
		// Fold at the playfield bounds: trajectories remain inside the diagram.
		const fold = function(value: number): number {
			const width = 100 - 2 * plan.radius;
			const phase = ((value - plan.radius) % (2 * width) + 2 * width) % (2 * width);
			return plan.radius + (phase <= width ? phase : 2 * width - phase);
		};
		const offset = (elapsed - plan.centerAt) * plan.speed / 1000;
		const first = fold(50 + offset); const second = fold(50 - offset);
		return {kind: 'collision', circles: [
			{x: plan.vertical ? 50 - plan.clearance / 2 : first, y: plan.vertical ? first : 50 - plan.clearance / 2, radius: plan.radius},
			{x: plan.vertical ? 50 + plan.clearance / 2 : second, y: plan.vertical ? second : 50 + plan.clearance / 2, radius: plan.radius},
		]};
	}
	const frame = plan.frames.filter(function(frame) { return frame.at <= elapsed; }).at(-1) ?? plan.frames[0];
	if (frame === undefined) throw new Error('Maze schedule is empty');
	return {kind: 'maze', tokens: plan.tokens, graph: frame.graph};
};
const makePlan = function(config: PathTimeConfig, random: () => number): {readonly plan: PathTimePlan; readonly hold: number} {
	const preset = temporalPresets[config.difficulty];
	if (config.mode === 'countdown-to-zero') {
		const hold = claimHoldMs[config.difficulty];
		return {hold, plan: {kind: 'countdown', startDigit: preset.startDigit, holdMs: hold}};
	}
	if (config.mode === 'colliding-shapes') {
		const hold = claimHoldMs[config.difficulty];
		const speed = config.motionSpeed ?? preset.speed;
		const overlapMs = config.overlapMs ?? preset.overlapMs;
		const radius = 12;
		const connected = sample(random) < 0.7;
		// Tune perpendicular clearance to keep speed and overlap duration independent.
		const clearance = connected ? Math.sqrt((2 * radius) ** 2 - (speed * overlapMs / 1000) ** 2) : 2 * radius + 8;
		const margin = 2 * radius / speed * 1000 + 100;
		const centerAt = margin + sample(random) * Math.max(0, Math.min(hold - margin, 37 / speed * 1000) - margin);
		return {hold, plan: {kind: 'collision', speed, radius, clearance, centerAt, vertical: sample(random) < 0.5}};
	}
	if (config.mode === 'mouse-to-cheese') return {hold: preset.mouseHoldMs, plan: {kind: 'maze', tokens: 'mouse-cheese', frames: [{at: 0, graph: mouseGraph(config.difficulty, random)}]}};
	const hold = preset.mazeHoldMs;
	const frames = cornerFrames(config.difficulty, random);
	const canConnect = sample(random) < 0.75;
	return {hold, plan: {kind: 'maze', tokens: 'corners', frames: frames.map(function(graph, i) {
		const disconnected = frames[0];
		if (disconnected === undefined) throw new Error('Missing maze');
		return {at: i * hold / frames.length, graph: !canConnect && reachable(graph) ? disconnected : graph};
	})}};
};
const names: Readonly<Record<PathTimeId, string>> = {'mouse-to-cheese': 'Mouse to Cheese', 'countdown-to-zero': 'Countdown to Zero', 'colliding-shapes': 'Colliding Shapes', 'corner-to-corner': 'Corner to Corner'};
const prompts: Readonly<Record<PathTimeId, string>> = {'mouse-to-cheese': 'Press if the mouse can reach the cheese.', 'countdown-to-zero': 'Press on zero.', 'colliding-shapes': 'Press when the shapes overlap.', 'corner-to-corner': 'Press when the corners connect.'};
export const createPathTimeMode = function(id: PathTimeId): RuntimeMode {
	const claim = function(time: number, identity: number, config: PathTimeConfig, random: () => number): PathTimeStimulus {
		const {plan, hold} = makePlan(config, random);
		return {mode: id, id: identity, showing: 'claim', startedAt: time, until: time + hold, plan, drawing: commitDrawing(plan, 0), blocked: []};
	};
	const gap = function(state: PathTimeStimulus, time: number, config: PathTimeConfig, random: () => number): PathTimeStimulus {
		return {...state, id: state.id + 1, showing: 'gap', until: time + duration(config.gap, random), blocked: []};
	};
	return defineMode<PathTimeConfig, PathTimeStimulus>({
		id, name: names[id], defaults: pathTimeDefaults(id),
		rules: [prompts[id], 'First eligible correct press: +1, followed by a 2-second answer reveal.', 'Wrong press: −1 once; that player stays blocked for this entire puzzle.', ...(id === 'mouse-to-cheese' ? ['Crossing strands pass over each other. Only marked junctions connect.'] : []), 'Missing a target costs nothing. Release before pressing again.'],
		isConfig: function(config: Config): config is PathTimeConfig { return config.mode === id; },
		isStimulus: function(state: Stimulus): state is PathTimeStimulus { return state.mode === id; },
		validate: function(config) {
			if (!difficulties.includes(config.difficulty)) throw new Error('Invalid difficulty');
			const speed = config.motionSpeed ?? temporalPresets[config.difficulty].speed;
			const overlapMs = config.overlapMs ?? temporalPresets[config.difficulty].overlapMs;
			if (!Number.isFinite(speed) || speed < 20 || speed > 100 || !Number.isFinite(overlapMs) || overlapMs < 100 || speed * overlapMs / 1000 >= 24) throw new Error('Invalid collision controls');
			return {...config, ...validateShared(config)};
		},
		create: claim,
		advance: function(state, time, config, random) {
			if (time >= state.until) return state.showing === 'claim' && id === 'countdown-to-zero' ? gap(state, time, config, random) : claim(time, state.id + 1, config, random);
			if (state.showing === 'gap') return state;
			return {...state, drawing: commitDrawing(state.plan, Math.max(0, time - state.startedAt))};
		},
		press: function(state, {player, time}, config, random) {
			if (state.showing === 'gap' || state.blocked.includes(player)) return null;
			if (drawingTrue(state.drawing)) return award(state, player, gap(state, time, config, random));
			return {stimulus: {...state, blocked: [...state.blocked, player]}, delta: -1, player, identity: state.id};
		},
		present: function(state) { return state.showing === 'gap' ? {kind: 'blank', prompt: prompts[id]} : state.drawing.kind === 'countdown' ? {kind: 'text', text: String(state.drawing.digit), prompt: prompts[id]} : {kind: 'path-time', drawing: state.drawing, prompt: prompts[id]}; },
		explain: function(state) {
			const drawing = state.drawing;
			if (drawing.kind === 'countdown') return {message: drawing.digit === 0 ? 'Zero is the target.' : `${drawing.digit} is not zero. Wait for the next countdown.`};
			if (drawing.kind === 'collision') return {message: drawingTrue(drawing) ? 'The circles overlap.' : 'The circles are separate. Touching edges alone do not count.'};
			return {message: reachable(drawing.graph) ? 'The endpoints are connected.' : 'There is no continuous route between the endpoints.'};
		},
	});
};
export const pathTimeModes = pathTimeIds.map(createPathTimeMode);
