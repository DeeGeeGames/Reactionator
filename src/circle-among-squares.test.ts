import {describe, expect, test} from 'bun:test';
import {Game} from './game';
import {circleAmongSquares, circleDefaults, circlePrompt} from './circle-among-squares';
import {defaults, listModes, registerMode, requireMode, validateConfig, type CircleAmongSquaresConfig, type CircleStimulus, type FieldShape, type Stimulus} from './mode';
import {loadModes} from './modes';

const seeded = function(seed: number): () => number {
	let value = seed;
	return function() {
		value = (Math.imul(value, 1_664_525) + 1_013_904_223) >>> 0;
		return value / 0x1_0000_0000;
	};
};
const asCircle = function(stimulus: Stimulus | null): CircleStimulus {
	if (stimulus === null || stimulus.mode !== 'circle-among-squares') throw new Error('Expected circle stimulus');
	return stimulus;
};
const claimOf = function(config: CircleAmongSquaresConfig, random: () => number = function() { return 0; }): CircleStimulus {
	const opened = asCircle(circleAmongSquares.create(0, 1, config, function() { return 0; }));
	return asCircle(circleAmongSquares.advance(opened, opened.until, config, random));
};
const reveal = function(board: CircleStimulus, config: CircleAmongSquaresConfig, random: () => number = function() { return 0; }): CircleStimulus {
	if (board.showing !== 'claim') throw new Error('Expected a scheduled circle');
	return asCircle(circleAmongSquares.advance(board, board.until, config, random));
};
const overlaps = function(first: FieldShape, second: FieldShape): boolean {
	const reach = (first.size + second.size) / 2;
	return Math.abs(first.x - second.x) < reach && Math.abs(first.y - second.y) < reach;
};
const fixture = function(config: CircleAmongSquaresConfig, random: () => number) {
	let time = 0;
	const game = new Game(function() { return time; }, random, {rounds: 5, modes: [config]});
	return {game, advance: function(ms: number, frame = true) { time += ms; if (frame) game.frame(); }};
};
const begin = function(game: Game, advance: (ms: number) => void) {
	game.select(4); game.start();
	for (const player of game.state.players) game.press(player);
	advance(game.config.countdownMs);
};
const advanceUntilVisible = function(game: Game, advance: (ms: number) => void): void {
	const config = game.config;
	if (config.mode !== 'circle-among-squares') throw new Error('Expected a Circle match');
	for (let elapsed = 0; elapsed < 10_000; elapsed += 100) {
		const state = asCircle(game.state.stimulus);
		const probe = circleAmongSquares.press({...state, blocked: []}, {player: 1, time: 0}, config, function() { return 0; });
		if (probe?.delta === 1) return;
		advance(100);
	}
	throw new Error('Expected the moving circle to become visible');
};
describe('circle among squares', function() {
	test('registers beside Press on White with typed default configurations', function() {
		expect(loadModes()).toEqual(['press-on-white', 'circle-among-squares']);
		expect(listModes().map(function(mode) { return mode.id; })).toEqual(['press-on-white', 'circle-among-squares']);
		expect(() => registerMode(circleAmongSquares)).toThrow();
		expect(() => requireMode('missing-mode')).toThrow();
		expect(() => requireMode('press-on-white').validate(circleDefaults)).toThrow();
		expect(() => requireMode('circle-among-squares').validate(defaults)).toThrow();
		const selected = new Game(function() { return 0; }, function() { return 0; }, {rounds: 5, modes: [circleDefaults]});
		expect(selected.mode.id).toBe('circle-among-squares');
		expect(selected.mode.name).toBe('Circle among squares');
	});
	test('copies a valid config and rejects a broken match shell', function() {
		const config = validateConfig(circleDefaults);
		expect(config).toEqual(circleDefaults);
		expect(config.gap).not.toBe(circleDefaults.gap);
		expect(() => validateConfig({...circleDefaults, roundMs: 0})).toThrow();
		expect(() => validateConfig({...circleDefaults, gap: [0, 2]})).toThrow();
	});
	test('builds varied, overlapping free-positioned fields for all retained difficulties', function() {
		const specs = [['easy', 20], ['medium', 28], ['hard', 36], ['insane', 44]] as const;
		for (const [difficulty, count] of specs) {
			const config = {...circleDefaults, difficulty};
			const scene = claimOf(config, seeded(7));
			if (scene.showing !== 'claim') throw new Error('Expected a field');
			expect(scene.squares).toHaveLength(count);
			expect(scene.squares.every(function(shape) { return shape.shape === 'square'; })).toBe(true);
			expect(new Set(scene.squares.map(function(shape) { return shape.color; })).size).toBeGreaterThan(1);
			expect(new Set(scene.squares.map(function(shape) { return shape.size; })).size).toBeGreaterThan(1);
			expect(scene.squares.every(function(shape) {
				return shape.x >= shape.size / 2 && shape.x <= 1 - shape.size / 2
					&& shape.y >= shape.size / 2 && shape.y <= 1 - shape.size / 2;
			})).toBe(true);
			const shown = reveal(scene, config, seeded(11));
			if (shown.showing !== 'claim' || shown.circle === null) throw new Error('Expected a spawned circle');
			const circle = shown.circle;
			const cover = shown.squares.find(function(shape) {
				return shape.x === circle.x && shape.y === circle.y && shape.size >= circle.size;
			});
			expect(cover).toBeDefined();
			if (cover === undefined) throw new Error('Expected the circle to be fully covered');
			const halfSizeCircle = reveal(scene, config, function() { return 0; });
			if (halfSizeCircle.showing !== 'claim' || halfSizeCircle.circle === null) throw new Error('Expected a spawned circle');
			expect(halfSizeCircle.circle.size).toBe(Math.min(0.17, cover.size) * 0.5);
			const hasOverlap = scene.squares.some(function(shape, index) {
				return scene.squares.slice(index + 1).some(function(other) { return overlaps(shape, other); });
			});
			expect(hasOverlap).toBe(true);
		}
	});
	test('moves shapes by elapsed active time with frame-rate-independent reflected motion', function() {
		const config = circleDefaults;
		const scene = claimOf(config, function() { return 0.99; });
		if (scene.showing !== 'claim') throw new Error('Expected a field');
		const noRandom = function(): number { throw new Error('Movement must not draw randomness'); };
		const direct = asCircle(circleAmongSquares.advance(scene, scene.sceneStartedAt + 1_500, config, noRandom));
		let stepped: CircleStimulus = scene;
		for (let frame = 1; frame <= 15; frame += 1) {
			stepped = asCircle(circleAmongSquares.advance(stepped, scene.sceneStartedAt + frame * 100, config, noRandom));
		}
		if (direct.showing !== 'claim' || stepped.showing !== 'claim') throw new Error('Expected the moving field');
		expect(direct.squares.map(function(shape) { return [shape.x, shape.y]; })).toEqual(stepped.squares.map(function(shape) { return [shape.x, shape.y]; }));
		expect(direct.squares.some(function(shape, index) {
			const initial = scene.squares[index];
			return initial !== undefined && (shape.x !== initial.x || shape.y !== initial.y);
		})).toBe(true);
		expect(direct.squares.every(function(shape) {
			return shape.x >= shape.size / 2 && shape.x <= 1 - shape.size / 2
				&& shape.y >= shape.size / 2 && shape.y <= 1 - shape.size / 2;
		})).toBe(true);
	});
	test('spawns the moving circle fully covered, then keeps it present while it and the field move', function() {
		const scene = claimOf(circleDefaults);
		if (scene.showing !== 'claim') throw new Error('Expected a field');
		const shown = reveal(scene, circleDefaults);
		if (shown.showing !== 'claim' || shown.circle === null) throw new Error('Expected a visible circle');
		const targetCircle = shown.circle;
		expect(targetCircle.shape).toBe('circle');
		expect(targetCircle.size).toBeGreaterThanOrEqual(0.085);
		expect(targetCircle.size).toBeLessThanOrEqual(0.11);
		expect(targetCircle.motion.startedAt).toBe(scene.until);
		const coveringSquare = shown.squares.find(function(square) {
			return square.x === targetCircle.x && square.y === targetCircle.y && square.size >= targetCircle.size;
		});
		expect(coveringSquare).toBeDefined();
		if (coveringSquare === undefined) throw new Error('Expected the circle to be covered at spawn');
		const noRandom = function(): number { throw new Error('Movement must not draw randomness'); };
		const stableRandom = function(): number { return 0; };
		const hiddenPress = circleAmongSquares.press(shown, {player: 1, time: shown.circle.motion.startedAt}, circleDefaults, noRandom);
		expect(hiddenPress?.delta).toBe(-1);
		const geometryCircle = {...targetCircle, x: 0.5, y: 0.5, size: 0.2};
		const leftOccluder = {...coveringSquare, id: 'test:left-occluder', x: 0.45, y: 0.5, size: 0.2};
		const rightOccluder = {...coveringSquare, id: 'test:right-occluder', x: 0.55, y: 0.5, size: 0.2};
		const partialExposure = circleAmongSquares.press({...shown, circle: geometryCircle, squares: [leftOccluder], blocked: []},
			{player: 2, time: targetCircle.motion.startedAt}, circleDefaults, stableRandom);
		expect(partialExposure?.delta).toBe(1);
		expect(circleAmongSquares.present({...shown, circle: geometryCircle, squares: [leftOccluder]})).toMatchObject({circleVisible: true});
		const combinedOcclusion = circleAmongSquares.press({...shown, circle: geometryCircle,
			squares: [leftOccluder, rightOccluder], blocked: []},
			{player: 2, time: targetCircle.motion.startedAt}, circleDefaults, stableRandom);
		expect(combinedOcclusion?.delta).toBe(-1);
		expect(circleAmongSquares.present({...shown, circle: geometryCircle,
			squares: [leftOccluder, rightOccluder]})).toMatchObject({circleVisible: false});
		let visibleField: CircleStimulus | undefined;
		for (let elapsed = 100; elapsed <= 10_000; elapsed += 100) {
			const moved = asCircle(circleAmongSquares.advance(shown, targetCircle.motion.startedAt + elapsed, circleDefaults, noRandom));
			const outcome = circleAmongSquares.press({...moved, blocked: []},
				{player: 2, time: targetCircle.motion.startedAt + elapsed}, circleDefaults, stableRandom);
			if (outcome?.delta === 1) {
				visibleField = moved;
				break;
			}
		}
		expect(visibleField).toBeDefined();
		if (visibleField === undefined) throw new Error('Expected the moving circle to become visible');
		expect(shown.until).toBe(Number.POSITIVE_INFINITY);
		const presentation = circleAmongSquares.present(shown);
		expect(presentation).toMatchObject({kind: 'field', prompt: circlePrompt, sceneId: scene.sceneId, circleVisible: false});
		if (presentation.kind !== 'field') throw new Error('Expected a field presentation');
		expect(presentation.shapes).toHaveLength(scene.squares.length + 1);
		expect(presentation.shapes[0]).toBe(targetCircle);
		const moving = asCircle(circleAmongSquares.advance(shown, scene.until + 250, circleDefaults, noRandom));
		if (moving.showing !== 'claim' || moving.circle === null) throw new Error('Expected the circle to remain visible');
		expect(moving.circle.x !== targetCircle.x || moving.circle.y !== targetCircle.y).toBe(true);
		expect(moving.circle.x).toBeGreaterThanOrEqual(moving.circle.size / 2);
		expect(moving.circle.x).toBeLessThanOrEqual(1 - moving.circle.size / 2);
		expect(moving.circle.y).toBeGreaterThanOrEqual(moving.circle.size / 2);
		expect(moving.circle.y).toBeLessThanOrEqual(1 - moving.circle.size / 2);
		const muchLater = asCircle(circleAmongSquares.advance(shown, targetCircle.motion.startedAt + 10_000, circleDefaults, noRandom));
		if (muchLater.showing !== 'claim' || muchLater.circle === null) throw new Error('Expected the circle to remain present');
		expect(muchLater.circle.id).toBe(targetCircle.id);
		expect(muchLater.id).toBe(shown.id);
		expect(muchLater.until).toBe(Number.POSITIVE_INFINITY);
		expect(muchLater.squares.map(function(shape) { return shape.id; })).toEqual(scene.squares.map(function(shape) { return shape.id; }));
	});
	test('a late frame starts one persistent target instead of catching up unseen targets', function() {
		const scene = claimOf(circleDefaults);
		if (scene.showing !== 'claim') throw new Error('Expected a field');
		const lateTime = scene.until + 10_000;
		const shown = asCircle(circleAmongSquares.advance(scene, lateTime, circleDefaults, function() { return 0; }));
		if (shown.showing !== 'claim' || shown.circle === null) throw new Error('Expected a newly committed circle');
		expect(shown.circle.motion.startedAt).toBe(lateTime);
		expect(shown.until).toBe(Number.POSITIVE_INFINITY);
		const stillPresent = asCircle(circleAmongSquares.advance(shown, lateTime + 10_000, circleDefaults, function() { return 0; }));
		if (stillPresent.showing !== 'claim' || stillPresent.circle === null) throw new Error('Expected the circle to remain present');
		expect(stillPresent.circle.id).toBe(shown.circle.id);
	});
	test('scores once, penalizes wrong presses once per opportunity, and keeps the target until a correct press', function() {
		const {game, advance} = fixture(circleDefaults, function() { return 0; });
		begin(game, advance);
		advance(250);
		const field = asCircle(game.state.stimulus);
		game.press(1); game.press(1);
		expect(game.state.scores.total[1]).toBe(-1);
		expect(asCircle(game.state.stimulus).id).toBe(field.id);
		advance(250);
		game.press(1);
		expect(game.state.scores.total[1]).toBe(-1);
		const spawned = asCircle(game.state.stimulus);
		if (spawned.showing !== 'claim' || spawned.circle === null) throw new Error('Expected a spawned circle');
		advance(10_000);
		const persistent = asCircle(game.state.stimulus);
		if (persistent.showing !== 'claim' || persistent.circle === null) throw new Error('Expected the circle to remain present');
		advanceUntilVisible(game, advance);
		game.press(1);
		game.press(2);
		expect(game.state.scores.total[1]).toBe(-1);
		expect(game.state.scores.total[2]).toBe(1);
		expect(asCircle(game.state.stimulus).showing).toBe('gap');
	});
	test('starts a fresh run when false or wrong presses lock out every active player', function() {
		for (const count of [2, 3, 4]) {
			const {game, advance} = fixture(circleDefaults, function() { return 0; });
			game.select(count);
			game.start();
			for (const player of game.state.players) game.press(player);
			advance(game.config.countdownMs);
			const falseStartTarget = asCircle(game.state.stimulus);
			expect(falseStartTarget.showing).toBe('gap');
			for (const player of game.state.players) game.press(player);
			const falseStartReset = asCircle(game.state.stimulus);
			expect(falseStartReset.showing).toBe('gap');
			expect(falseStartReset.id).toBe(falseStartTarget.id + 1);
			expect(falseStartReset.blocked).toEqual([]);
			advance(250);
			const abandoned = asCircle(game.state.stimulus);
			expect(abandoned.showing).toBe('claim');
			if (abandoned.showing !== 'claim') throw new Error('Expected a field');
			expect(abandoned.circle).toBeNull();
			for (const player of game.state.players) game.press(player);
			for (const player of game.state.players) expect(game.state.scores.total[player]).toBe(-2);
			const freshGap = asCircle(game.state.stimulus);
			expect(freshGap.showing).toBe('gap');
			expect(freshGap.id).toBe(abandoned.id + 1);
			expect(freshGap.blocked).toEqual([]);
			advance(250);
			const freshField = asCircle(game.state.stimulus);
			expect(freshField.showing).toBe('claim');
			expect(freshField.id).toBe(freshGap.id + 1);
			expect(freshField.blocked).toEqual([]);
		}
	});
	test('an uncommitted circle cannot score, and a committed visible circle stays scorable after many frames', function() {
		const {game, advance} = fixture(circleDefaults, function() { return 0; });
		begin(game, advance);
		advance(250);
		advance(250, false);
		game.press(2);
		expect(game.state.scores.total[2]).toBe(-1);
		const committed = fixture(circleDefaults, function() { return 0; });
		begin(committed.game, committed.advance);
		committed.advance(250);
		committed.advance(250);
		committed.advance(500, false);
		committed.game.press(1);
		expect(committed.game.state.scores.total[1]).toBe(-1);
		advanceUntilVisible(committed.game, committed.advance);
		committed.game.press(2);
		expect(committed.game.state.scores.total[2]).toBe(1);
		const hidden = fixture(circleDefaults, function() { return 0; });
		begin(hidden.game, hidden.advance);
		hidden.advance(250);
		hidden.advance(250);
		hidden.advance(500);
		advanceUntilVisible(hidden.game, hidden.advance);
		hidden.game.press(1);
		expect(hidden.game.state.scores.total[1]).toBe(1);
	});
	test('a blank false start locks that player out while another player can still score', function() {
		const {game, advance} = fixture(circleDefaults, function() { return 0; });
		begin(game, advance);
		advance(100, false);
		game.press(1);
		expect(game.state.scores.total[1]).toBe(-1);
		expect(asCircle(game.state.stimulus).showing).toBe('gap');
		advance(150);
		advance(250);
		const board = asCircle(game.state.stimulus);
		if (board.showing !== 'claim') throw new Error('Expected the next field');
		expect(board.circle).not.toBeNull();
		expect(board.blocked).toEqual([1]);
		advanceUntilVisible(game, advance);
		game.press(1);
		expect(game.state.scores.total[1]).toBe(-1);
		game.press(2);
		expect(game.state.scores.total[2]).toBe(1);
		expect(game.state.scores.total[1]).toBe(-1);
	});
	test('a press at the round deadline does not score', function() {
		const {game, advance} = fixture({...circleDefaults, roundMs: 1_000}, function() { return 0; });
		begin(game, advance);
		advance(250);
		advance(750, false);
		game.press(1);
		expect(game.state.phase).toBe('round-results');
		expect(game.state.scores.total[1]).toBe(0);
	});
	test('pause resumes into a fresh gap and keeps the score', function() {
		const {game, advance} = fixture(circleDefaults, function() { return 0; });
		begin(game, advance);
		advance(250);
		advance(250);
		advanceUntilVisible(game, advance);
		game.press(4);
		const remaining = game.state.remaining;
		game.pause('hidden');
		advance(60_000, false);
		game.resume();
		for (const player of game.state.players) game.press(player);
		advance(3_000);
		expect(game.state.phase).toBe('playing');
		expect(asCircle(game.state.stimulus).showing).toBe('gap');
		expect(game.state.remaining).toBe(remaining);
		expect(game.state.scores.total[4]).toBe(1);
	});
});
