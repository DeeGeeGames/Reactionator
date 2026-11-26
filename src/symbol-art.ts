import type {SymbolKind} from './mode';

// Keep the existing rule identities; artwork and player-facing names share this mapping.
export const symbolNames: Readonly<Record<SymbolKind, {readonly single: string; readonly plural: string}>> = {
	circle: {single: 'clock', plural: 'clocks'},
	square: {single: 'book', plural: 'books'},
	triangle: {single: 'umbrella', plural: 'umbrellas'},
	diamond: {single: 'kite', plural: 'kites'},
	star: {single: 'key', plural: 'keys'},
	pentagon: {single: 'mug', plural: 'mugs'},
	camera: {single: 'camera', plural: 'cameras'},
	pencil: {single: 'pencil', plural: 'pencils'},
	scissors: {single: 'pair of scissors', plural: 'pairs of scissors'},
	apple: {single: 'apple', plural: 'apples'},
	guitar: {single: 'guitar', plural: 'guitars'},
	lightbulb: {single: 'light bulb', plural: 'light bulbs'},
	envelope: {single: 'envelope', plural: 'envelopes'},
	shoe: {single: 'shoe', plural: 'shoes'},
	teapot: {single: 'teapot', plural: 'teapots'},
	rocket: {single: 'rocket', plural: 'rockets'},
};

const ns = 'http://www.w3.org/2000/svg';
export const drawSymbol = function(kind: SymbolKind, index: number): SVGSVGElement {
	const svg = document.createElementNS(ns, 'svg');
	svg.setAttribute('viewBox', '0 0 100 100');
	svg.setAttribute('role', 'img');
	svg.setAttribute('aria-label', symbolNames[kind].single);
	svg.dataset.symbol = kind;
	const drawing = document.createElementNS(ns, 'g');
	// Position supplies decorative rotation, never the identity or the answer.
	drawing.setAttribute('transform', `rotate(${[-12, 10, -6, 15, -9][index % 5] ?? 0} 50 50)`);
	drawing.setAttribute('stroke', '#20252c');
	drawing.setAttribute('stroke-width', '3');
	drawing.setAttribute('stroke-linejoin', 'round');
	drawing.setAttribute('stroke-linecap', 'round');
	const part = function<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Readonly<Record<string, string | number>>): void {
		const node = document.createElementNS(ns, tag);
		for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
		drawing.append(node);
	};
	if (kind === 'circle') {
		part('path', {d: 'M26 75 L20 87 M74 75 L80 87 M44 12 H56', fill: 'none', stroke: '#ffc857', 'stroke-width': 6});
		part('circle', {cx: 50, cy: 49, r: 33, fill: '#ffc857'});
		part('circle', {cx: 50, cy: 49, r: 25, fill: '#fff4d9'});
		part('path', {d: 'M50 30 V49 L65 58', fill: 'none', 'stroke-width': 5});
		part('path', {d: 'M16 25 Q18 8 35 13 M65 13 Q82 8 84 25', fill: '#ff7a72'});
	} else if (kind === 'square') {
		part('path', {d: 'M24 12 H78 V82 H28 Q18 82 18 72 V23 Q18 12 24 12Z', fill: '#69a9ff'});
		part('path', {d: 'M28 69 H78 V82 H28 Q17 82 18 75 Q18 69 28 69Z', fill: '#fff4d9'});
		part('path', {d: 'M30 13 V67 M42 30 H66 M42 40 H61', fill: 'none'});
		part('path', {d: 'M57 70 V90 L64 84 L71 90 V70', fill: '#ff7a72'});
	} else if (kind === 'triangle') {
		part('path', {d: 'M50 18 V73 Q50 88 65 83 Q71 80 68 74', fill: 'none', stroke: '#ffc857', 'stroke-width': 5});
		part('path', {d: 'M10 49 Q16 15 50 16 Q84 15 90 49 Q80 39 70 49 Q60 39 50 49 Q40 39 30 49 Q20 39 10 49Z', fill: '#ff7a72'});
		part('path', {d: 'M30 47 Q32 24 50 16 Q68 24 70 47', fill: 'none', stroke: '#fff4d9'});
	} else if (kind === 'diamond') {
		part('path', {d: 'M50 8 L82 37 L50 70 L18 37Z', fill: '#b896ff'});
		part('path', {d: 'M50 8 V70 M18 37 H82', fill: 'none', stroke: '#fff4d9', 'stroke-width': 2});
		part('path', {d: 'M50 70 Q70 79 48 90', fill: 'none', stroke: '#ffc857'});
		part('path', {d: 'M55 74 L46 72 L48 80Z M57 83 L67 80 L65 89Z', fill: '#43c8b8'});
	} else if (kind === 'star') {
		part('path', {d: 'M46 38 L86 78 L78 87 L69 78 L65 82 L57 74 L61 70 L36 47Z', fill: '#ffc857'});
		part('circle', {cx: 32, cy: 32, r: 23, fill: '#ffc857'});
		part('circle', {cx: 32, cy: 32, r: 11, fill: '#1c2027'});
	} else if (kind === 'pentagon') {
		part('path', {d: 'M65 32 H75 Q94 32 90 54 Q88 70 66 67 V57 Q79 60 80 49 Q82 42 68 43Z', fill: '#43c8b8'});
		part('path', {d: 'M15 25 H68 V65 Q68 82 43 82 Q18 82 18 65Z', fill: '#43c8b8'});
		part('ellipse', {cx: 42, cy: 26, rx: 27, ry: 7, fill: '#fff4d9'});
		part('ellipse', {cx: 42, cy: 27, rx: 20, ry: 3, fill: '#81583d', stroke: 'none'});
		part('path', {d: 'M28 47 Q24 61 31 68', fill: 'none', stroke: '#b8f1de', 'stroke-width': 4});
	} else if (kind === 'camera') {
		part('path', {d: 'M29 31 L35 18 H64 L71 31Z', fill: '#b896ff'});
		part('rect', {x: 12, y: 29, width: 76, height: 51, rx: 7, fill: '#69a9ff'});
		part('circle', {cx: 50, cy: 54, r: 20, fill: '#20252c'});
		part('circle', {cx: 50, cy: 54, r: 13, fill: '#43c8b8'});
		part('path', {d: 'M43 48 Q47 42 53 44', fill: 'none', stroke: '#fff4d9', 'stroke-width': 3});
		part('rect', {x: 72, y: 36, width: 9, height: 7, rx: 1, fill: '#fff4d9'});
	} else if (kind === 'pencil') {
		part('path', {d: 'M22 63 L66 19 L81 34 L37 78Z', fill: '#ffc857'});
		part('path', {d: 'M22 63 L17 83 L37 78Z', fill: '#fff4d9'});
		part('path', {d: 'M17 83 L20 73 L27 80Z', fill: '#20252c'});
		part('path', {d: 'M66 19 L73 12 L88 27 L81 34Z', fill: '#ff7a72'});
		part('path', {d: 'M29 70 L73 26', fill: 'none', stroke: '#fff4d9', 'stroke-width': 2});
	} else if (kind === 'scissors') {
		part('path', {d: 'M34 64 L69 13 Q76 6 76 18 L47 70Z', fill: '#fff4d9'});
		part('path', {d: 'M66 64 L31 13 Q24 6 24 18 L53 70Z', fill: '#fff4d9'});
		part('circle', {cx: 28, cy: 76, r: 13, fill: '#b896ff'});
		part('circle', {cx: 72, cy: 76, r: 13, fill: '#b896ff'});
		part('circle', {cx: 28, cy: 76, r: 7, fill: '#fff4d9'});
		part('circle', {cx: 72, cy: 76, r: 7, fill: '#fff4d9'});
		part('circle', {cx: 50, cy: 51, r: 5, fill: '#ffc857'});
	} else if (kind === 'apple') {
		part('path', {d: 'M50 31 Q47 16 57 10', fill: 'none', stroke: '#81583d', 'stroke-width': 5});
		part('path', {d: 'M54 23 Q57 8 78 12 Q76 28 54 23Z', fill: '#43c8b8'});
		part('path', {d: 'M50 31 C25 8 9 35 19 65 C26 91 42 89 50 84 C65 94 78 82 84 61 C94 33 69 16 50 31Z', fill: '#ff7a72'});
		part('path', {d: 'M31 39 Q23 47 28 60', fill: 'none', stroke: '#fff4d9', 'stroke-width': 5});
	} else if (kind === 'guitar') {
		part('path', {d: 'M38 55 L65 21 L75 31 L48 64Z', fill: '#81583d'});
		part('path', {d: 'M64 22 L69 10 L85 23 L75 33Z', fill: '#b896ff'});
		part('path', {d: 'M45 47 Q37 34 25 39 Q15 45 25 58 Q5 64 16 81 Q31 98 47 84 Q63 82 61 66 Q59 57 45 47Z', fill: '#ffc857'});
		part('circle', {cx: 36, cy: 66, r: 8, fill: '#20252c'});
		part('path', {d: 'M28 77 L73 22 M32 80 L77 26', fill: 'none', stroke: '#fff4d9', 'stroke-width': 1.5});
		part('path', {d: 'M25 75 L35 83', fill: 'none', stroke: '#81583d', 'stroke-width': 4});
	} else if (kind === 'lightbulb') {
		part('path', {d: 'M37 68 C37 58 24 54 24 35 A26 26 0 0 1 76 35 C76 54 63 58 63 68Z', fill: '#ffc857'});
		part('path', {d: 'M42 65 V48 L34 41 M58 65 V48 L66 41', fill: 'none', 'stroke-width': 2});
		part('path', {d: 'M40 20 Q30 24 31 35', fill: 'none', stroke: '#fff4d9', 'stroke-width': 4});
		part('rect', {x: 37, y: 68, width: 26, height: 15, rx: 2, fill: '#69a9ff'});
		part('path', {d: 'M38 75 H62 M43 85 H57', fill: 'none', 'stroke-width': 4});
	} else if (kind === 'envelope') {
		part('rect', {x: 11, y: 25, width: 78, height: 52, rx: 5, fill: '#fff4d9'});
		part('path', {d: 'M13 27 L50 58 L87 27 M13 75 L39 52 M87 75 L61 52', fill: 'none'});
		part('circle', {cx: 50, cy: 59, r: 8, fill: '#ff7a72'});
	} else if (kind === 'shoe') {
		part('path', {d: 'M13 60 L28 34 L50 37 L58 53 L85 64 Q92 68 88 81 H14Z', fill: '#69a9ff'});
		part('path', {d: 'M13 74 H89 V84 H12Z', fill: '#fff4d9'});
		part('path', {d: 'M29 42 L45 46 M26 49 L49 54 M23 57 L52 62', fill: 'none', stroke: '#fff4d9', 'stroke-width': 4});
		part('path', {d: 'M66 61 L59 71 H78', fill: 'none', stroke: '#b896ff', 'stroke-width': 4});
	} else if (kind === 'teapot') {
		part('circle', {cx: 77, cy: 51, r: 15, fill: '#b896ff'});
		part('circle', {cx: 77, cy: 51, r: 8, fill: '#1c2027'});
		part('path', {d: 'M25 50 L14 35 L8 39 Q8 68 30 68Z', fill: '#ff7a72'});
		part('ellipse', {cx: 48, cy: 59, rx: 28, ry: 24, fill: '#ff7a72'});
		part('path', {d: 'M23 37 Q48 20 73 37Z', fill: '#b896ff'});
		part('circle', {cx: 48, cy: 26, r: 5, fill: '#ffc857'});
		part('path', {d: 'M31 81 H65 V86 H31Z', fill: '#fff4d9'});
	} else if (kind === 'rocket') {
		part('path', {d: 'M41 71 Q38 83 50 92 Q62 83 59 71Z', fill: '#ffc857'});
		part('path', {d: 'M35 50 L20 70 L22 83 L39 69 M65 50 L80 70 L78 83 L61 69', fill: '#ff7a72'});
		part('path', {d: 'M35 68 Q23 42 50 9 Q77 42 65 68Z', fill: '#fff4d9'});
		part('path', {d: 'M37 26 Q43 15 50 9 Q57 15 63 26Z', fill: '#ff7a72'});
		part('circle', {cx: 50, cy: 40, r: 10, fill: '#69a9ff'});
		part('path', {d: 'M35 68 H65', fill: 'none'});
	}
	svg.append(drawing);
	return svg;
};
