import {describe, expect, test} from 'bun:test';
import {Game} from './game';
import {listPlayableModes} from './modes';
import {enabledModesFromStorage, matchForEnabledModes, serializeEnabledModes} from './settings';

const ids = listPlayableModes().map(function(mode) { return mode.id; });

describe('rotation settings', function() {
	test('defaults to every playable mode for absent, invalid, or empty saved rotations', function() {
		for (const stored of [null, '{', '{}', 'null', '[1]', JSON.stringify(ids)]) {
			expect(enabledModesFromStorage(stored)).toEqual(ids);
		}
	});

	test('restores exclusions, ignores unknown IDs, and enables newly registered modes by default', function() {
		expect(enabledModesFromStorage('["press-on-white","removed-mode"]')).toEqual(ids.filter(function(id) { return id !== 'press-on-white'; }));
		const enabled = ['press-on-white', 'true-equation'];
		expect(enabledModesFromStorage(serializeEnabledModes(enabled))).toEqual(ids.filter(function(id) { return enabled.includes(id); }));
		expect(enabledModesFromStorage('[]')).toEqual(ids);
	});

	test('excluded game types never enter the rotation across cycles or rematches', function() {
		let time = 0;
		const enabled = ['press-on-white', 'true-equation'];
		const game = new Game(function() { return time; }, function() { return 0.9; }, matchForEnabledModes(enabled));
		game.select(3);
		game.start();
		const played: string[] = [];
		for (let round = 0; round < game.match.rounds; round += 1) {
			for (const player of game.state.players) game.press(player);
			played.push(game.mode.id);
			time += game.config.countdownMs;
			game.frame();
			time += game.config.roundMs;
			game.frame();
		}
		expect(game.state.phase).toBe('match-results');
		for (let start = 0; start < played.length; start += 2) expect(played.slice(start, start + 2).sort()).toEqual(enabled);
		game.rematch();
		expect(enabled).toContain(game.mode.id);
		const configuredIds: readonly string[] = game.match.modes.map(function(config) { return config.mode; }).sort();
		expect(configuredIds).toEqual(enabled);
		expect(game.state.players).toHaveLength(3);
	});

	test('one enabled game can repeat and a new setup can restore all games', function() {
		let time = 0;
		const config = matchForEnabledModes(['true-equation']);
		const game = new Game(function() { return time; }, function() { return 0; }, config);
		game.start();
		for (let round = 0; round < game.match.rounds; round += 1) {
			for (const player of game.state.players) game.press(player);
			expect(game.mode.id).toBe('true-equation');
			time += game.config.countdownMs; game.frame();
			time += game.config.roundMs; game.frame();
		}
		expect(game.state.phase).toBe('match-results');
		game.end();
		const restored = new Game(function() { return time; }, function() { return 0; }, matchForEnabledModes(ids));
		expect(restored.match.modes).toHaveLength(ids.length);
	});
});
