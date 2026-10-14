import {describe, expect, test} from 'bun:test';
import {Game} from './game';
import {defaults, difficulties, requireMode, type Difficulty, type RuntimeMode, type StaticStimulus, type Stimulus} from './mode';
import {claimHoldMs, staticDefaults} from './static-challenges';
import {fiveDifferent, matchingPair, threeOfAKind} from './symbol-challenges';
import {colorWord, trueEquation} from './text-challenges';

const staticState = function(state: Stimulus | null): StaticStimulus {
	if (state === null || state.mode === 'press-on-white' || state.mode === 'circle-among-squares') throw new Error('Expected static challenge');
	return state;
};
const staticModeId = function(mode: RuntimeMode) {
	const id = mode.id;
	if (id !== 'three-of-a-kind' && id !== 'five-different' && id !== 'matching-pair' && id !== 'color-word' && id !== 'true-equation') throw new Error('Expected static mode');
	return id;
};
const fixture = function(mode: RuntimeMode, difficulty: Difficulty, random: () => number) {
	let time = 0;
	const config = {...staticDefaults(staticModeId(mode)), difficulty};
	const game = new Game(function() { return time; }, random, {rounds: 1, modes: [config]});
	const advance = function(ms: number, frame = true) { time += ms; if (frame) game.frame(); };
	game.select(2); game.start(); game.press(1); game.press(2); advance(config.countdownMs);
	return {game, config, advance};
};
const testedModes = [threeOfAKind, fiveDifferent, matchingPair, colorWord, trueEquation];
describe('shared static challenge lifecycle', function() {
	for (const mode of testedModes) {
		for (const difficulty of difficulties) {
			test(`${mode.id} ${difficulty}: committed gap blocks once, eligible true claim scores and clears`, function() {
				const config = {...staticDefaults(staticModeId(mode)), difficulty};
				const gap = mode.create(0, 1, config, () => 0);
				const miss = mode.press(gap, {player: 1, time: 250}, config, () => 0);
				if (miss === null) throw new Error('Missing penalty');
				expect(miss.delta).toBe(-1);
				expect(mode.press(miss.stimulus, {player: 1, time: 250}, config, () => 0)).toBeNull();
				const claim = staticState(mode.advance(miss.stimulus, 250, config, () => 0));
				expect(claim.until).toBe(250 + claimHoldMs[difficulty]);
				expect(mode.press(claim, {player: 1, time: 251}, config, () => 0)).toBeNull();
				const award = mode.press(claim, {player: 2, time: 251}, config, () => 0);
				if (award === null) throw new Error('Missing award');
				expect(award.delta).toBe(1);
				expect(staticState(award.stimulus).showing).toBe('gap');
				expect(award.stimulus.blocked).toEqual([]);
			});
			test(`${mode.id} ${difficulty}: false board persists, timeout scores nothing and resets blocks`, function() {
				const config = {...staticDefaults(staticModeId(mode)), difficulty};
				const gap = mode.create(0, 1, config, () => 0.9);
				const claim = mode.advance(gap, gap.until, config, () => 0.9);
				const miss = mode.press(claim, {player: 1, time: gap.until + 1}, config, () => 0.9);
				if (miss === null) throw new Error('Missing penalty');
				expect(miss.delta).toBe(-1);
				expect(staticState(miss.stimulus).showing).toBe('claim');
				expect(mode.press(miss.stimulus, {player: 1, time: gap.until + 2}, config, () => 0.9)).toBeNull();
				expect(mode.press(miss.stimulus, {player: 2, time: gap.until + 2}, config, () => 0.9)?.delta).toBe(-1);
				expect(mode.advance(miss.stimulus, claim.until - 1, config, () => 0.9)).toBe(miss.stimulus);
				const next = mode.advance(miss.stimulus, claim.until, config, () => 0.9);
				expect(staticState(next).showing).toBe('gap'); expect(next.blocked).toEqual([]);
			});
		}
		test(`${mode.id}: runner rejects deadline input and pause resumes into fresh gap`, function() {
			const {game, advance} = fixture(mode, 'easy', () => 0);
			advance(250); game.press(1); advance(250); game.pause('hidden');
			const remaining = game.state.remaining;
			advance(60_000); expect(game.state.remaining).toBe(remaining);
			game.resume(); game.press(1); game.press(2); advance(game.config.countdownMs);
			expect(staticState(game.state.stimulus).showing).toBe('gap');
			expect(game.state.scores.total[1]).toBe(1);
			advance(250); advance(remaining - 250, false); game.press(2);
			expect(game.state.phase).toBe('match-results'); expect(game.state.scores.total[2]).toBe(0);
		});
	}
	test('runtime mode rejects mismatched config and stimulus', function() {
		const mode = requireMode('three-of-a-kind');
		expect(function() { mode.create(0, 1, defaults, () => 0); }).toThrow();
		const wrong = matchingPair.create(0, 1, staticDefaults('matching-pair'), () => 0);
		expect(function() { mode.present(wrong); }).toThrow();
		expect(function() { mode.press(wrong, {player: 1, time: 0}, staticDefaults('three-of-a-kind'), () => 0); }).toThrow();
	});
});
