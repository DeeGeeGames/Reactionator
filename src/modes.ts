import {circleAmongSquares} from './circle-among-squares';
import {listModes, requireMode, type Config, type RuntimeMode} from './mode';

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
