import {SVGPathData} from 'svg-pathdata';
import type {Figure, VectorPart} from './figure-types';
const path = function(d: string, fill: 'dark' | 'light' = 'dark'): VectorPart { return {kind: 'path', d, fill}; };
const ellipse = function(cx: number, cy: number, rx: number, ry: number, fill: 'dark' | 'light' = 'dark'): VectorPart { return {kind: 'ellipse', cx, cy, rx, ry, fill}; };
const eyes = [ellipse(38, 48, 3, 4), ellipse(62, 48, 3, 4), ellipse(50, 65, 5, 3)];
const face = [ellipse(50, 50, 34, 33), ellipse(50, 53, 27, 26, 'light'), ...eyes];
const figure = function(id: string, description: string, animal: boolean, canFly: boolean, madeByPeople: boolean, drawing: readonly VectorPart[]): Figure {
	return {id, description, animal, canFly, madeByPeople, drawing};
};
/** Original normalized 100 x 100 artwork. Tags describe ordinary real objects, not thrown objects or toys. */
export const figures: readonly Figure[] = [
	figure('sparrow', 'Flying sparrow with beak, pointed wings and forked tail', true, true, false, [path('M8 54 L33 43 Q18 18 23 10 L52 36 Q66 22 73 34 L92 38 L77 45 Q72 63 52 61 L34 84 L32 66 L12 72 L26 57 Z'), ellipse(69, 36, 2, 2, 'light')]),
	figure('butterfly', 'Butterfly with four broad wings and narrow body', true, true, false, [path('M48 43 Q10 0 8 34 Q7 52 28 54 Q4 80 28 87 Q43 88 50 60 Q58 90 77 87 Q96 75 73 54 Q97 49 91 28 Q81 3 53 43 Z'), ellipse(50, 52, 4, 31), ellipse(27, 35, 10, 9, 'light'), ellipse(74, 35, 10, 9, 'light')]),
	figure('bat', 'Bat with pointed ears and scalloped outstretched wings', true, true, false, [path('M5 23 Q30 27 42 44 L44 23 L50 30 L56 23 L58 44 Q72 27 95 23 L85 68 Q73 50 67 73 Q57 58 50 85 Q43 58 33 73 Q27 50 15 68 Z'), ellipse(47, 41, 2, 2, 'light'), ellipse(54, 41, 2, 2, 'light')]),
	figure('dog', 'Dog face with long floppy ears and rounded muzzle', true, false, false, [ellipse(20, 47, 13, 32), ellipse(80, 47, 13, 32), ...face, ellipse(50, 64, 14, 10, 'light'), ellipse(50, 59, 6, 4)]),
	figure('cat', 'Cat face with triangular ears and whiskers', true, false, false, [path('M16 44 L16 8 L40 25 L60 25 L84 8 L84 44 Z'), ...face, path('M12 58 L36 62 L12 68 M88 58 L64 62 L88 68 L64 66 L88 62 L64 60 L88 58'), ellipse(50, 63, 4, 3)]),
	figure('fish', 'Fish with tail fin, dorsal fin and round eye', true, false, false, [path('M9 28 L32 42 Q56 14 90 50 Q56 86 32 58 L9 74 L16 50 Z M42 33 L51 14 L65 32 Z'), ellipse(72, 46, 4, 4, 'light'), path('M48 42 L58 50 L48 61 Z', 'light')]),
	figure('panda', 'Panda with round dark ears, pale face, two dark eye patches and muzzle', true, false, false, [ellipse(24, 22, 14, 14), ellipse(76, 22, 14, 14), ellipse(50, 53, 37, 35), ellipse(50, 53, 30, 29, 'light'), ellipse(36, 48, 10, 13), ellipse(64, 48, 10, 13), ellipse(37, 46, 3, 3, 'light'), ellipse(63, 46, 3, 3, 'light'), ellipse(50, 67, 13, 10, 'light'), ellipse(50, 62, 6, 4), path('M48 64 L52 64 L52 71 L58 73 L57 76 L50 73 L43 76 L42 73 L48 71 Z')]),
	figure('rabbit', 'Rabbit face with two long upright ears', true, false, false, [ellipse(33, 26, 10, 23), ellipse(67, 26, 10, 23), ellipse(33, 25, 4, 16, 'light'), ellipse(67, 25, 4, 16, 'light'), ...face, ellipse(50, 64, 8, 6)]),
	figure('bear', 'Brown bear with round ears and pale muzzle, no eye patches', true, false, false, [ellipse(24, 22, 14, 14), ellipse(76, 22, 14, 14), ...face, ellipse(50, 65, 14, 10, 'light'), ellipse(50, 60, 6, 4)]),
	figure('plane', 'Airliner seen from above with swept wings and tailplane', false, true, true, [path('M46 8 Q50 0 54 8 L57 39 L92 64 L92 73 L56 60 L55 80 L68 89 L68 95 L50 90 L32 95 L32 89 L45 80 L44 60 L8 73 L8 64 L43 39 Z')]),
	figure('helicopter', 'Helicopter side view with rotor, tail and landing skids', false, true, true, [path('M8 12 L88 12 L88 17 L53 17 L53 28 Q78 28 85 53 L79 65 L38 65 L20 48 L7 43 L7 24 L14 24 L18 40 L37 42 L44 31 L47 29 L47 17 L8 17 Z M42 63 L47 63 L47 76 L73 76 L73 63 L78 63 L78 76 L86 76 L86 82 L33 82 L33 76 L42 76 Z'), path('M58 35 Q72 36 76 48 L58 48 Z', 'light')]),
	figure('hammer', 'Claw hammer with long handle and heavy head', false, false, true, [path('M15 15 L65 15 L86 28 L80 38 L62 30 L58 41 L48 41 L48 91 L33 91 L33 41 L15 41 Z')]),
	figure('cup', 'Handled cup with open interior and saucer', false, false, true, [path('M17 25 L67 25 L67 31 Q95 24 94 50 Q94 72 65 66 Q58 84 27 75 Z M12 85 L86 85 L81 91 L17 91 Z'), path('M69 39 L68 57 Q85 60 85 49 Q85 36 69 39 Z', 'light'), ellipse(42, 29, 20, 4, 'light')]),
	figure('chair', 'Chair side with high back, seat and four legs', false, false, true, [path('M16 8 L28 8 L28 50 L81 50 L81 63 L73 63 L80 92 L69 92 L60 63 L33 63 L26 92 L15 92 L22 63 L16 63 Z')]),
	figure('bicycle', 'Bicycle with two wheels and diamond frame', false, false, true, [ellipse(24, 68, 21, 21), ellipse(77, 68, 21, 21), ellipse(24, 68, 15, 15, 'light'), ellipse(77, 68, 15, 15, 'light'), path('M24 68 L40 37 L65 37 L77 68 L72 70 L61 42 L44 42 L29 65 L51 65 L39 30 L31 30 L31 25 L49 25 L49 30 L45 30 L56 62 L67 23 L79 23 L79 28 L71 28 L59 71 L24 71 Z')]),
	figure('tree', 'Tree with branching canopy and solid trunk', false, false, false, [path('M44 94 L44 68 Q15 76 12 52 Q1 29 25 24 Q27 2 50 10 Q77 0 80 26 Q101 33 89 56 Q84 73 56 68 L56 94 Z')]),
	figure('rock', 'Irregular low angular boulder', false, false, false, [path('M6 72 L17 38 L39 24 L72 30 L91 53 L96 77 L66 85 L25 82 Z'), path('M23 43 L40 32 L62 37 L39 41 L28 61 Z', 'light')]),
];
export const validateFigures = function(catalog: readonly Figure[]): void {
	const ids = new Set<string>();
	for (const entry of catalog) {
		if (!entry.id || !entry.description || ids.has(entry.id) || entry.drawing.length === 0
			|| [entry.animal, entry.canFly, entry.madeByPeople].some(function(tag) { return typeof tag !== 'boolean'; })) throw new Error('Invalid figure catalog');
		ids.add(entry.id);
		for (const part of entry.drawing) {
			if (part.fill !== 'dark' && part.fill !== 'light') throw new Error('Invalid vector tone');
			if (part.kind === 'path') {
				const commands = SVGPathData.parse(part.d);
				if (commands[0]?.type !== SVGPathData.MOVE_TO || !commands.some(function(command) { return (command.type & SVGPathData.DRAWING_COMMANDS) !== 0; })) throw new Error('Invalid vector path');
			} else if (![part.cx, part.cy, part.rx, part.ry].every(Number.isFinite) || part.rx <= 0 || part.ry <= 0
				|| part.cx - part.rx < 0 || part.cx + part.rx > 100 || part.cy - part.ry < 0 || part.cy + part.ry > 100) throw new Error('Invalid ellipse');
		}
	}
};
validateFigures(figures);
