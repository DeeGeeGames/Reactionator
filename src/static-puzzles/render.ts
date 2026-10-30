import type {AnswerExplanation} from '../mode';
import type {CountObject, Puzzle} from './contracts';
import './style.css';
const ns = 'http://www.w3.org/2000/svg';
const svg = function<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Readonly<Record<string, string | number>>, parent: SVGElement): SVGElementTagNameMap[K] {
	const node = document.createElementNS(ns, tag);
	for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
	parent.append(node); return node;
};
const line = function(parent: SVGElement, x1: number, y1: number, x2: number, y2: number, color = '#f4f4f5', width = 3): void {
	svg('line', {x1, y1, x2, y2, stroke: color, 'stroke-width': width, 'stroke-linecap': 'butt'}, parent);
};
const colors = {red: '#ff7a72', blue: '#69a9ff', green: '#43c8b8'};
const shape = function(parent: SVGElement, object: CountObject, x: number, y: number, radius: number): void {
	const attrs = {fill: colors[object.color], stroke: '#11151c', 'stroke-width': 1};
	if (object.shape === 'circle') svg('circle', {...attrs, cx: x, cy: y, r: radius}, parent);
	else if (object.shape === 'square') svg('rect', {...attrs, x: x - radius, y: y - radius, width: radius * 2, height: radius * 2}, parent);
	else svg('polygon', {...attrs, points: `${x},${y - radius} ${x + radius},${y + radius} ${x - radius},${y + radius}`}, parent);
};
const fieldPosition = function(index: number, columns: number, rows: number, width = 480, height = 180): readonly [number, number, number] {
	return [10 + (index % columns + 0.5) * (width - 20) / columns, 10 + (Math.floor(index / columns) + 0.5) * (height - 20) / rows, Math.min((width - 20) / columns, (height - 20) / rows) * 0.4];
};
export const renderPuzzle = function(puzzle: Puzzle, feedback: AnswerExplanation | null): SVGSVGElement {
	const root = document.createElementNS(ns, 'svg');
	const field = puzzle.type === 'sad-face' || puzzle.type === 'shape-count' || puzzle.type === 'plus-and-minus';
	const illusion = puzzle.type === 'equal-t' || puzzle.type === 'equal-arrows' || puzzle.type === 'equal-track-bars';
	root.setAttribute('viewBox', field ? '0 0 480 180' : illusion ? '0 0 600 180' : '0 0 300 300'); root.setAttribute('role', 'img'); root.setAttribute('aria-label', 'Reaction puzzle');
	const highlight = function(parent: SVGElement, index: number, x: number, y: number, radius: number): void {
		if (feedback?.highlightedSymbols?.includes(index)) svg('rect', {x: x - radius, y: y - radius, width: radius * 2, height: radius * 2, rx: 4, fill: 'none', stroke: '#fff', 'stroke-width': 2}, parent);
	};
	if (puzzle.type === 'sad-face') {
		for (const [index, face] of puzzle.faces.entries()) {
			const [x, y, r] = fieldPosition(index, Math.ceil(puzzle.faces.length / 3), 3);
			const group = svg('g', {transform: `translate(${x} ${y}) rotate(${face.rotation})`, stroke: face.color, 'stroke-width': 2.5, fill: 'none'}, root);
			svg('circle', {cx: 0, cy: 0, r}, group);
			for (const eye of [-0.33, 0.33]) svg('circle', {cx: r * eye, cy: -r * 0.25, r: r * 0.065, fill: face.color}, group);
			svg('path', {d: face.sad ? `M ${-r * 0.5} ${r * 0.5} Q 0 ${-r * 0.2} ${r * 0.5} ${r * 0.5}` : `M ${-r * 0.5} ${r * 0.15} Q 0 ${r * 0.85} ${r * 0.5} ${r * 0.15}`}, group);
			highlight(root, index, x, y, r + 3);
		}
	} else if (puzzle.type === 'shape-count' || puzzle.type === 'plus-and-minus') {
		const count = puzzle.type === 'shape-count' ? puzzle.objects.length : puzzle.signs.length;
		const columns = Math.ceil(count / 3); const rows = Math.ceil(count / columns);
		for (let index = 0; index < count; index++) {
			const [x, y, r] = fieldPosition(index, columns, rows);
			if (puzzle.type === 'shape-count') {
				const object = puzzle.objects[index]; if (object !== undefined) shape(root, object, x, y, r);
			} else {
				line(root, x - r * 0.7, y, x + r * 0.7, y, '#ffc857', 3);
				if (puzzle.signs[index] === '+') line(root, x, y - r * 0.7, x, y + r * 0.7, '#ffc857', 3);
			}
			highlight(root, index, x, y, r + 2);
		}
	} else if (puzzle.type === 'alphabet-order') {
		// Upright letter copies are rendered in the prompt regions, at a readable CSS size.
	} else if (puzzle.type === 'three-in-a-row' || puzzle.type === 'four-in-a-line') {
		const size = Math.min(270 / puzzle.columns, 270 / puzzle.rows);
		const ox = (300 - puzzle.columns * size) / 2; const oy = (300 - puzzle.rows * size) / 2;
		for (const [index, mark] of puzzle.cells.entries()) {
			const x = ox + (index % puzzle.columns + 0.5) * size; const y = oy + (Math.floor(index / puzzle.columns) + 0.5) * size;
			svg('rect', {x: x - size / 2, y: y - size / 2, width: size, height: size, fill: '#192431', stroke: '#657184', 'stroke-width': 1}, root);
			if (mark !== null) {
				const r = size * 0.32;
				if (puzzle.type === 'three-in-a-row' && mark === 'A') { line(root, x - r, y - r, x + r, y + r, '#ffc857', 5); line(root, x + r, y - r, x - r, y + r, '#ffc857', 5); }
				else {
					svg('circle', {cx: x, cy: y, r, fill: puzzle.type === 'three-in-a-row' ? 'none' : mark === 'A' ? '#ffc857' : '#69a9ff', stroke: mark === 'A' ? '#ffc857' : '#69a9ff', 'stroke-width': 4}, root);
					if (puzzle.type === 'four-in-a-line' && mark === 'B') svg('circle', {cx: x, cy: y, r: r * 0.45, fill: 'none', stroke: '#192431', 'stroke-width': 2}, root);
				}
			}
			highlight(root, index, x, y, size * 0.43);
		}
	} else {
		// Each edge sees an upright copy of the same numeric diagram, at one uniform scale.
		for (const far of [false, true]) {
			const group = svg('g', {transform: `translate(${far ? 0 : 300} 10) ${far ? 'rotate(180 150 80)' : ''}`}, root);
			if (puzzle.type === 'equal-t') {
				line(group, 150 - puzzle.barLength / 2, 5, 150 + puzzle.barLength / 2, 5);
				line(group, 150, 5, 150, 5 + puzzle.stemLength);
			} else if (puzzle.type === 'equal-arrows') {
				for (const [index, length] of puzzle.shafts.entries()) {
					const y = 35 + index * 80; const left = 150 - length / 2; const right = 150 + length / 2;
					line(group, left, y, right, y);
					const dx = 23 * Math.cos(puzzle.finAngle * Math.PI / 180); const dy = 23 * Math.sin(puzzle.finAngle * Math.PI / 180);
					const direction = index === 0 ? 1 : -1;
					for (const sign of [-1, 1]) { line(group, left, y, left + dx * direction, y + dy * sign); line(group, right, y, right - dx * direction, y + dy * sign); }
				}
			} else if (puzzle.type === 'equal-track-bars') {
				line(group, 150 - puzzle.convergence, 0, 40, 155, '#657184', 2);
				line(group, 150 + puzzle.convergence, 0, 260, 155, '#657184', 2);
				for (const [index, bar] of puzzle.bars.entries()) line(group, bar.left, 35 + index * 85, bar.right, 35 + index * 85, '#ffc857', 7);
			}
		}
	}
	return root;
};

export const appendPuzzleClaim = function(parent: HTMLElement, puzzle: Puzzle, feedback: AnswerExplanation | null): void {
	if (puzzle.type === 'shape-count') {
		const claim = document.createElement('span'); claim.className = 'puzzle-claim';
		claim.append(`${puzzle.filter.color.toUpperCase()} `);
		const sample = document.createElementNS(ns, 'svg'); sample.setAttribute('viewBox', '0 0 30 30');
		sample.setAttribute('aria-label', puzzle.filter.shape); shape(sample, puzzle.filter, 15, 15, 10);
		claim.append(sample, ` ${puzzle.operator} ${puzzle.count}`); parent.append(claim);
	} else if (puzzle.type === 'plus-and-minus') {
		const claim = document.createElement('span'); claim.className = 'puzzle-claim'; claim.textContent = puzzle.statement; parent.append(claim);
	} else if (puzzle.type === 'alphabet-order') {
		const letters = document.createElement('span'); letters.className = 'puzzle-alphabet';
		for (const [index, letter] of puzzle.letters.entries()) {
			const node = document.createElement('span'); node.textContent = letter;
			if (feedback?.highlightedSymbols?.includes(index)) node.className = 'puzzle-defect';
			letters.append(node);
		}
		parent.append(letters);
	}
};
