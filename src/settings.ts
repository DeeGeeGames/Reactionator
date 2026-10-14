import {DEFAULT_ROUNDS, type MatchConfig} from './game';
import {defaultConfigFor, listPlayableModes} from './modes';

export const ROTATION_STORAGE_KEY = 'reaction-mix.disabled-modes';

export const enabledModesFromStorage = function(stored: string | null): readonly string[] {
	const ids = listPlayableModes().map(function(mode) { return mode.id; });
	if (stored === null) return ids;
	try {
		const disabled: unknown = JSON.parse(stored);
		if (!Array.isArray(disabled) || !disabled.every(function(id: unknown) { return typeof id === 'string'; })) return ids;
		const enabled = ids.filter(function(id) { return !disabled.includes(id); });
		return enabled.length === 0 ? ids : enabled;
	} catch {
		return ids;
	}
};

export const serializeEnabledModes = function(enabled: readonly string[]): string {
	return JSON.stringify(listPlayableModes().filter(function(mode) { return !enabled.includes(mode.id); }).map(function(mode) { return mode.id; }));
};

export const matchForEnabledModes = function(enabled: readonly string[]): MatchConfig {
	return {
		rounds: DEFAULT_ROUNDS,
		modes: listPlayableModes().filter(function(mode) { return enabled.includes(mode.id); }).map(function(mode) { return defaultConfigFor(mode.id); }),
	};
};
