import {award, defineMode, duration, registerMode, sample, validateShared, type CircleAmongSquaresConfig, type CircleShape, type CircleStimulus, type Config, type Difficulty, type FieldShape, type GlyphColor, type Player, type Presentation, type ShapeMotion, type SquareShape, type Stimulus} from './mode';

export const circlePrompt = 'Press if you see a circle.';
const circleSizeScale = 0.5;
const colors: readonly GlyphColor[] = ['coral', 'gold', 'teal', 'blue', 'violet'];
interface ScenePreset {
	readonly count: number;
	readonly minSize: number;
	readonly maxSize: number;
	readonly minSpeed: number;
	readonly maxSpeed: number;
	readonly waitMs: number;
}
const scenePresets: Readonly<Record<Difficulty, ScenePreset>> = {
	easy: {count: 20, minSize: 0.12, maxSize: 0.20, minSpeed: 0.10, maxSpeed: 0.20, waitMs: 5_000},
	medium: {count: 28, minSize: 0.10, maxSize: 0.19, minSpeed: 0.12, maxSpeed: 0.24, waitMs: 3_500},
	hard: {count: 36, minSize: 0.08, maxSize: 0.18, minSpeed: 0.14, maxSpeed: 0.28, waitMs: 2_500},
	insane: {count: 44, minSize: 0.07, maxSize: 0.16, minSpeed: 0.16, maxSpeed: 0.32, waitMs: 1_800},
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
const valueAt = function<T>(values: readonly T[], index: number): T {
	const value = values[index];
	if (value === undefined) throw new Error('Invalid scene value');
	return value;
};
const makeMotion = function(originX: number, originY: number, speedX: number, speedY: number, random: () => number, startedAt: number): ShapeMotion {
	const velocityX = speedX * (sample(random) < 0.5 ? -1 : 1);
	const velocityY = speedY * (sample(random) < 0.5 ? -1 : 1);
	return {originX, originY, velocityX, velocityY, startedAt};
};
const makeShapeCore = function(sceneId: number, id: string, color: GlyphColor, size: number,
	preset: ScenePreset, startedAt: number, random: () => number, origin?: {readonly x: number; readonly y: number}) {
	const originX = origin === undefined ? size / 2 + sample(random) * (1 - size) : origin.x;
	const originY = origin === undefined ? size / 2 + sample(random) * (1 - size) : origin.y;
	const speedX = preset.minSpeed + sample(random) * (preset.maxSpeed - preset.minSpeed);
	const speedY = preset.minSpeed + sample(random) * (preset.maxSpeed - preset.minSpeed);
	return {
		id: `${sceneId}:${id}`, x: originX, y: originY, size, color,
		motion: makeMotion(originX, originY, speedX, speedY, random, startedAt),
	};
};
const makeSquare = function(sceneId: number, index: number, color: GlyphColor, size: number,
	preset: ScenePreset, time: number, random: () => number): SquareShape {
	return {...makeShapeCore(sceneId, `square-${index}`, color, size, preset, time, random), shape: 'square'};
};
const makeCircle = function(sceneId: number, identity: number, time: number, preset: ScenePreset,
	squares: readonly SquareShape[], random: () => number): CircleShape {
	const firstSquare = squares[0];
	if (firstSquare === undefined) throw new Error('A scene needs at least one square');
	const cover = squares.slice(1).reduce(function(largest, square) {
		return square.size > largest.size ? square : largest;
	}, firstSquare);
	const size = Math.min(0.17 + sample(random) * 0.05, cover.size) * circleSizeScale;
	const color = valueAt(colors, Math.floor(sample(random) * colors.length));
	const shape = makeShapeCore(sceneId, `circle-${identity}`, color, size, preset, time, random, {x: cover.x, y: cover.y});
	return {...shape, motion: {
		...shape.motion,
		velocityX: Math.sign(shape.motion.velocityX) * preset.maxSpeed,
		velocityY: Math.sign(shape.motion.velocityY) * preset.maxSpeed,
	}, shape: 'circle'};
};
const makeSquares = function(sceneId: number, time: number, preset: ScenePreset, random: () => number): readonly SquareShape[] {
	const colorOffset = Math.floor(sample(random) * colors.length);
	return Array.from({length: preset.count}, function(_value, index) {
		const color = valueAt(colors, (index + colorOffset) % colors.length);
		const sizeBand = (index % 4 + sample(random)) / 4;
		const size = preset.minSize + sizeBand * (preset.maxSize - preset.minSize);
		return makeSquare(sceneId, index, color, size, preset, time, random);
	});
};
const reflectedPosition = function(origin: number, velocity: number, size: number, elapsedMs: number): number {
	const lower = size / 2;
	const span = 1 - size;
	const period = span * 2;
	const traveled = origin - lower + velocity * Math.max(0, elapsedMs) / 1_000;
	const phase = ((traveled % period) + period) % period;
	return phase <= span ? lower + phase : lower + period - phase;
};
const moveShape = function(shape: FieldShape, time: number): {readonly x: number; readonly y: number} {
	return {
		x: reflectedPosition(shape.motion.originX, shape.motion.velocityX, shape.size, time - shape.motion.startedAt),
		y: reflectedPosition(shape.motion.originY, shape.motion.velocityY, shape.size, time - shape.motion.startedAt),
	};
};
const moveSquare = function(shape: SquareShape, time: number): SquareShape {
	const position = moveShape(shape, time);
	return position.x === shape.x && position.y === shape.y ? shape : {...shape, ...position};
};
const moveCircle = function(shape: CircleShape, time: number): CircleShape {
	const position = moveShape(shape, time);
	return position.x === shape.x && position.y === shape.y ? shape : {...shape, ...position};
};
const circleTouchesRectangle = function(circle: CircleShape, left: number, right: number, top: number, bottom: number): boolean {
	const radius = circle.size / 2;
	const dx = circle.x < left ? left - circle.x : circle.x > right ? circle.x - right : 0;
	const dy = circle.y < top ? top - circle.y : circle.y > bottom ? circle.y - bottom : 0;
	return dx * dx + dy * dy < radius * radius;
};
const circleIsVisible = function(circle: CircleShape, squares: readonly SquareShape[]): boolean {
	const radius = circle.size / 2;
	const left = circle.x - radius;
	const right = circle.x + radius;
	const top = circle.y - radius;
	const bottom = circle.y + radius;
	const xEvents = [...new Set([left, right, ...squares.flatMap(function(square) {
		return [square.x - square.size / 2, square.x + square.size / 2]
			.filter(function(edge) { return edge > left && edge < right; });
	})])].sort(function(first, second) { return first - second; });
	for (let index = 0; index < xEvents.length - 1; index += 1) {
		const stripLeft = xEvents[index];
		const stripRight = xEvents[index + 1];
		if (stripLeft === undefined || stripRight === undefined || stripRight <= stripLeft) continue;
		const middleX = (stripLeft + stripRight) / 2;
		const covered = squares.filter(function(square) {
			return middleX > square.x - square.size / 2 && middleX < square.x + square.size / 2;
		}).map(function(square) {
			return {top: Math.max(top, square.y - square.size / 2), bottom: Math.min(bottom, square.y + square.size / 2)};
		}).filter(function(interval) { return interval.bottom > interval.top; })
			.sort(function(first, second) { return first.top - second.top; });
		let coveredUntil = top;
		for (const interval of covered) {
			if (interval.top > coveredUntil && circleTouchesRectangle(circle, stripLeft, stripRight, coveredUntil, interval.top)) return true;
			coveredUntil = Math.max(coveredUntil, interval.bottom);
			if (coveredUntil >= bottom) break;
		}
		if (coveredUntil < bottom && circleTouchesRectangle(circle, stripLeft, stripRight, coveredUntil, bottom)) return true;
	}
	return false;
};
const claim = function(time: number, id: number, config: CircleAmongSquaresConfig, random: () => number, blocked: readonly Player[]): CircleStimulus {
	const preset = scenePresets[config.difficulty];
	return {
		mode: 'circle-among-squares', showing: 'claim', id, until: time + duration([250, preset.waitMs], random), blocked,
		sceneId: id, sceneStartedAt: time, squares: makeSquares(id, time, preset, random), circle: null,
	};
};
const present = function(state: CircleStimulus): Presentation {
	if (state.showing === 'gap') return {kind: 'blank', prompt: circlePrompt};
	return {kind: 'field', prompt: circlePrompt, sceneId: state.sceneId,
		circleVisible: state.circle !== null && circleIsVisible(state.circle, state.squares),
		shapes: state.circle === null ? state.squares : [state.circle, ...state.squares]};
};
export const circleAmongSquares = defineMode({
	id: 'circle-among-squares', name: 'Circle among squares',
	defaults: circleDefaults,
	rules: [
		circlePrompt,
		'First eligible press while any part of a circle is visible: +1. The visible circle stays highlighted for 2 seconds.',
		'Squares only, a fully hidden circle, or a blank gap: −1. A blank false start also locks you out of the next circle.',
		'If false or wrong presses lock out every player before anyone scores, discard the field and start a fresh run after a blank gap.',
		'Missing a circle costs nothing. Release before pressing again.',
		'Each circle starts fully hidden behind a square, then moves independently and remains until a correct press starts a fresh field after a blank gap.',
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
		const squares = state.squares.map(function(shape) { return moveSquare(shape, time); });
		if (state.circle !== null) {
			const circle = moveCircle(state.circle, time);
			if (squares.every(function(shape, index) { return shape === state.squares[index]; }) && circle === state.circle) return state;
			return {...state, squares, circle};
		}
		if (time < state.until) {
			if (squares.every(function(shape, index) { return shape === state.squares[index]; })) return state;
			return {...state, squares};
		}
		const preset = scenePresets[config.difficulty];
		return {...state, id: state.id + 1, squares, circle: makeCircle(state.sceneId, state.id + 1, time, preset, squares, random),
			until: Number.POSITIVE_INFINITY};
	},
	press: function(state, {player, time, players}, config, random) {
		if (state.blocked.includes(player)) return null;
		if (state.showing === 'claim' && state.circle !== null && circleIsVisible(state.circle, state.squares)) {
			return award(state, player, gap(time, state.id + 1, config, random));
		}
		const blocked = [...state.blocked, player];
		const exhausted = players !== undefined && players.length > 0 && players.every(function(activePlayer) { return blocked.includes(activePlayer); });
		return {stimulus: exhausted ? gap(time, state.id + 1, config, random) : {...state, blocked}, delta: -1, player, identity: state.id};
	},
	explain: function(state, delta) {
		if (state.showing === 'gap') return {message: 'Wait for the circle field.'};
		const circleVisible = state.circle !== null && circleIsVisible(state.circle, state.squares);
		if (delta > 0 && circleVisible) return {message: 'The circle is visible between the squares.', highlightCircle: true};
		if (!circleVisible && state.circle !== null) {
			const coveredBy = state.squares.filter(function(square) {
				const half = square.size / 2;
				return state.circle !== null
					&& state.circle.x >= square.x - half && state.circle.x <= square.x + half
					&& state.circle.y >= square.y - half && state.circle.y <= square.y + half;
			}).map(function(square) { return square.id; });
			return {message: coveredBy.length > 1
				? 'The circle is fully hidden behind the highlighted squares.'
				: 'The circle is fully hidden behind a highlighted square.', highlightedShapes: coveredBy};
		}
		return circleVisible
			? {message: 'Press only when part of the circle is visible.'}
			: {message: 'No circle is visible yet. Wait for it to emerge.'};
	},
	present,
});
registerMode(circleAmongSquares);
