import {circleAmongSquares} from './circle-among-squares';
import {listModes} from './mode';

export const loadModes = function(): readonly string[] {
	const ids = listModes().map(function(mode) { return mode.id; });
	if (!ids.includes(circleAmongSquares.id)) throw new Error('Circle among squares failed to register');
	return ids;
};
