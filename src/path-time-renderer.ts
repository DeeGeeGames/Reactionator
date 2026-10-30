import type {PathTimeDrawing, PathGraph, Point} from './path-time-types';
const ns = 'http://www.w3.org/2000/svg';
const element = function<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Readonly<Record<string, string | number>>): SVGElementTagNameMap[K] {
	const node = document.createElementNS(ns, tag);
	for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
	return node;
};
const token = function(svg: SVGSVGElement, point: Point, cheese: boolean): void {
	const group = element('g', {transform: `translate(${point.x} ${point.y})`});
	if (cheese) {
		group.append(element('path', {d: 'M-4 -4 L5 0 L5 5 L-4 5 Z', fill: '#ffc857', stroke: '#322a13', 'stroke-width': 0.5}));
		for (const [x, y] of [[0, 1], [3, 3], [-2, 3]]) group.append(element('circle', {cx: String(x), cy: String(y), r: 0.8, fill: '#b97813'}));
	} else {
		group.append(element('path', {d: 'M-3 2 Q-12 6 -9 -2', fill: 'none', stroke: '#e9b9c4', 'stroke-width': 0.8}), element('ellipse', {cx: -1, cy: 0, rx: 4, ry: 2.8, fill: '#d6dce8'}), element('circle', {cx: 0, cy: -2, r: 1.8, fill: '#e9b9c4'}), element('circle', {cx: 2, cy: -0.5, r: 0.5, fill: '#101725'}), element('circle', {cx: 3.5, cy: 1, r: 0.6, fill: '#e9b9c4'}));
	}
	svg.append(group);
};
const drawGraph = function(svg: SVGSVGElement, graph: PathGraph, tokens: 'mouse-cheese' | 'corners'): void {
	const byId = new Map(graph.nodes.map(function(node) { return [node.id, node] as const; }));
	for (const edge of graph.edges) {
		const from = byId.get(edge.from); const to = byId.get(edge.to);
		if (from === undefined || to === undefined) throw new Error('Invalid passage endpoint');
		const c = edge.curve;
		const d = `M${from.x} ${from.y} ` + (c === undefined ? `L${to.x} ${to.y}` : `C${c[0].x} ${c[0].y} ${c[1].x} ${c[1].y} ${to.x} ${to.y}`);
		// Explicit nonjoining crossings: dark undercut and bright overpass.
		svg.append(element('path', {d, fill: 'none', stroke: '#101725', 'stroke-width': tokens === 'mouse-cheese' ? 2.8 : 3, 'stroke-linecap': 'round'}), element('path', {d, fill: 'none', stroke: '#ecf0f8', 'stroke-width': tokens === 'mouse-cheese' ? 0.9 : 1.7, 'stroke-linecap': 'round'}));
	}
	for (const node of graph.nodes) svg.append(element('circle', {cx: node.x, cy: node.y, r: tokens === 'mouse-cheese' ? 0.8 : 1.2, fill: '#ecf0f8'}));
	for (const [id, goal] of [[graph.start, false], [graph.goal, true]] as const) {
		const point = byId.get(id);
		if (point === undefined) throw new Error('Missing token endpoint');
		if (tokens === 'mouse-cheese') {
			svg.append(element('path', {d: `M${point.x} ${point.y} h${goal ? 3 : -3}`, stroke: '#ecf0f8', 'stroke-width': 0.9}));
			token(svg, {...point, x: point.x + (goal ? 5 : -5)}, goal);
		}
		else {
			svg.append(element('circle', {cx: point.x, cy: point.y, r: 4, fill: '#4aaaff', stroke: '#101725', 'stroke-width': 0.7}));
			const label = element('text', {x: point.x, y: point.y + 1.7, 'font-size': 5, 'text-anchor': 'middle', fill: '#101725', 'font-weight': 900});
			label.textContent = goal ? 'G' : 'S'; svg.append(label);
		}
	}
};
export const renderPathTime = function(drawing: PathTimeDrawing): SVGSVGElement {
	const svg = element('svg', {viewBox: '0 0 100 100', role: 'img', 'aria-label': drawing.kind === 'collision' ? 'Two moving circles' : 'Path puzzle'});
	if (drawing.kind === 'maze') drawGraph(svg, drawing.graph, drawing.tokens);
	if (drawing.kind === 'collision') for (const [i, circle] of drawing.circles.entries()) svg.append(element('circle', {cx: circle.x, cy: circle.y, r: circle.radius, fill: i === 0 ? '#ff7d79' : '#52bce8', 'fill-opacity': 0.82, stroke: '#ecf0f8', 'stroke-width': 0.5}));
	return svg;
};
