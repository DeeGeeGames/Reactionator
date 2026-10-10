import {circleAmongSquares} from './circle-among-squares';
import {listModes, requireMode, sample, type Config, type RuntimeMode} from './mode';

export const loadModes = function(): readonly string[] {
	const ids = listModes().map(function(mode) { return mode.id; });
	if (!ids.includes(circleAmongSquares.id)) throw new Error('Circle among squares failed to register');
	return ids;
};

export const listPlayableModes = function(): readonly RuntimeMode[] {
	loadModes();
	return listModes().filter(function(mode) { return mode.defaults !== undefined; });
};

export const defaultConfigFor = function(id: string): Config {
	loadModes();
	const mode = requireMode(id);
	if (mode.defaults === undefined || mode.defaults.mode !== id) throw new Error('Mode has no matching default configuration');
	return mode.validate(mode.defaults);
};

// Draw uniformly from the remaining pool, refilling only after a complete cycle.
export const drawMode = function<T>(modes: readonly T[], remaining: readonly T[], random: () => number): {readonly mode: T; readonly remaining: readonly T[]} {
	const pool = remaining.length === 0 ? modes : remaining;
	const index = pool.length === 1 ? 0 : Math.floor(sample(random) * pool.length);
	const mode = pool[index];
	if (mode === undefined) throw new Error('No playable modes');
	return {mode, remaining: pool.filter(function(_, candidate) { return candidate !== index; })};
};
