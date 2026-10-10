import {describe, expect, test} from 'bun:test';
import {circleDefaults} from './circle-among-squares';
import {Game} from './game';
import {defaults, emptyScores, registerMode, requireMode} from './mode';
import {defaultConfigFor, listPlayableModes} from './modes';

const fixture = function(id: string) {
	let time = 0;
	const game = new Game(function() { return time; }, function() { return 0; }, defaultConfigFor(id));
	return {game, advance: function(current: Game, ms: number) { time += ms; current.frame(); }};
};
const ready = function(game: Game): void {
	for (const player of game.state.players) game.press(player);
};

describe('setup mode selection', function() {
	test('offers registered defaults, validates selection, and keeps fresh loads on Press on White', function() {
		expect(listPlayableModes().map(function(mode) { return mode.id; })).toEqual(['press-on-white', 'circle-among-squares']);
		for (const config of [defaults, circleDefaults]) {
			const selected = defaultConfigFor(config.mode);
			expect(selected).toEqual(config);
			expect(selected).not.toBe(config);
			expect(selected.gap).not.toBe(config.gap);
		}
		expect(() => defaultConfigFor('catalog-only')).toThrow('Unknown mode');
		expect(() => registerMode({...requireMode('press-on-white'), id: 'catalog-only', defaults: circleDefaults})).toThrow('Mode does not match default configuration');
		expect(() => requireMode('catalog-only')).toThrow('Unknown mode');
		const game = new Game(function() { return 0; }, function() { return 0; });
		expect(game.config).toEqual(defaults);
		expect(game.selectMode('press-on-white')).toBe(game);
		expect(() => game.selectMode('catalog-only')).toThrow('Unknown mode');
	});

	test('switching modes retains every roster and discards prior match state', function() {
		for (const count of [2, 3, 4]) {
			for (const id of ['press-on-white', 'circle-among-squares']) {
				const {game, advance} = fixture(id);
				game.select(count); game.start(); ready(game);
				advance(game, game.config.countdownMs);
				game.press(1);
				expect(game.state.scores.total[1]).toBe(-1);
				expect(game.state.stimulus?.blocked).toContain(1);
				expect(game.state.feedback?.delta).toBe(-1);
				game.pause('hidden'); game.end();
				const nextId = id === 'press-on-white' ? 'circle-among-squares' : 'press-on-white';
				const selected = game.selectMode(nextId);
				expect(selected).not.toBe(game);
				expect(game.mode.id).toBe(id);
				expect(selected.state.players).toEqual(game.state.players);
				expect(selected.config).toEqual(defaultConfigFor(nextId));
				expect(selected.state).toEqual({
					phase: 'setup', players: game.state.players, ready: [], round: 1,
					remaining: selected.config.roundMs, countdown: 3, scores: emptyScores(),
					stimulus: null, feedback: null, pauseReason: '',
				});
				selected.start(); ready(selected); advance(selected, selected.config.countdownMs);
				expect(selected.state.stimulus?.mode).toBe(nextId);
				expect(selected.state.stimulus?.blocked).toEqual([]);
				advance(selected, 250); selected.press(1);
				expect(selected.state.scores.total[1]).toBe(1);
			}
		}
	});

	test('every round and rematch retain the selected defaults and roster with clean scores', function() {
		for (const count of [2, 3, 4]) {
			for (const mode of listPlayableModes()) {
				const {game, advance} = fixture(mode.id);
				game.select(count); game.start();
				for (let round = 1; round <= game.config.rounds; round += 1) {
					ready(game); advance(game, game.config.countdownMs);
					expect(game.state.stimulus).toMatchObject({mode: mode.id});
					advance(game, 250); game.press(1);
					expect(game.state.scores.total[1]).toBe(round);
					advance(game, game.config.roundMs);
				}
				expect(game.state.phase).toBe('match-results');
				const config = game.config;
				const players = game.state.players;
				game.rematch();
				expect(game.mode.id).toBe(mode.id);
				expect(game.config).toBe(config);
				expect(game.state.players).toEqual(players);
				expect(game.state.phase).toBe('ready');
				expect(game.state.scores).toEqual(emptyScores());
				expect(game.state.ready).toEqual([]);
				expect(game.state.round).toBe(1);
				expect(game.state.remaining).toBe(config.roundMs);
				expect(game.state.stimulus).toBeNull();
				expect(game.state.feedback).toBeNull();
				ready(game); advance(game, config.countdownMs);
				expect(game.state.stimulus).toMatchObject({mode: mode.id});
			}
		}
	});

	test('mode changes are ignored through readiness, play, pause, results, and rematch', function() {
		for (const mode of listPlayableModes()) {
			const {game, advance} = fixture(mode.id);
			const nextId = mode.id === 'press-on-white' ? 'circle-among-squares' : 'press-on-white';
			const unchanged = function(): void {
				const state = game.state;
				expect(game.selectMode(nextId)).toBe(game);
				expect(game.selectMode('catalog-only')).toBe(game);
				expect(game.state).toBe(state);
				expect(game.mode.id).toBe(mode.id);
			};
			game.start(); unchanged(); ready(game); unchanged();
			advance(game, game.config.countdownMs); unchanged();
			game.pause('paused'); unchanged(); game.resume(); unchanged();
			ready(game); advance(game, game.config.countdownMs);
			advance(game, game.config.roundMs); unchanged();
			for (let round = 2; round <= game.config.rounds; round += 1) {
				ready(game); advance(game, game.config.countdownMs); advance(game, game.config.roundMs);
			}
			unchanged(); game.rematch(); unchanged(); game.end();
			expect(game.selectMode(nextId).mode.id).toBe(nextId);
		}
	});
});
