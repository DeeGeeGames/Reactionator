import {sample, type Difficulty} from './mode';
import type {GraphNode, Passage, PathGraph} from './path-time-types';

export const reachable = function(graph: PathGraph): boolean {
	const seen = new Set([graph.start]);
	const queue = [graph.start];
	for (const node of queue) {
		for (const edge of graph.edges) {
			const next = edge.from === node ? edge.to : edge.to === node ? edge.from : undefined;
			if (next === undefined || seen.has(next)) continue;
			seen.add(next); queue.push(next);
		}
	}
	return seen.has(graph.goal);
};
const sizes: Readonly<Record<Difficulty, number>> = {easy: 4, medium: 5, hard: 6, insane: 8};
/** A sparse orthogonal labyrinth. Removing either marked bridge disconnects it. */
export const cornerFrames = function(difficulty: Difficulty, random: () => number): readonly PathGraph[] {
	const size = sizes[difficulty];
	const nodes: GraphNode[] = Array.from({length: size * size}, function(_, i) {
		return {id: String(i), x: 10 + i % size * 80 / (size - 1), y: 10 + Math.floor(i / size) * 80 / (size - 1)};
	});
	// A staircase route uses both dimensions, mirrored across the diagonal by the seed.
	const verticalFirst = sample(random) < 0.5;
	const route = [0];
	for (let i = 0; i < size - 1; i += 1) {
		const last = route[route.length - 1];
		if (last === undefined) throw new Error('Missing route');
		route.push(last + (verticalFirst ? size : 1), last + size + 1);
	}
	const edges: Passage[] = route.slice(1).map(function(to, i) {
		const from = route[i];
		if (from === undefined) throw new Error('Missing route node');
		return {from: String(from), to: String(to)};
	});
	// Attach unused nodes as dead-end trees, never creating an alternate bridge.
	const attached = new Set(route);
	for (let pass = 0; pass < size; pass += 1) {
		for (let i = 0; i < size * size; i += 1) {
			if (attached.has(i)) continue;
			const neighbors = [i % size > 0 ? i - 1 : -1, i >= size ? i - size : -1, i % size < size - 1 ? i + 1 : -1, i + size < size * size ? i + size : -1].filter(function(n) { return attached.has(n); });
			const parent = neighbors[Math.floor(sample(random) * neighbors.length)];
			if (parent === undefined) continue;
			edges.push({from: String(parent), to: String(i)}); attached.add(i);
		}
	}
	const bridge = Math.floor(sample(random) * (route.length - 1));
	const other = (bridge + Math.floor(route.length / 2)) % (route.length - 1);
	const graph = function(removed: number | null): PathGraph {
		return {nodes, edges: edges.filter(function(_, i) { return i !== removed; }), start: '0', goal: String(size * size - 1), crossing: 'bridge'};
	};
	return [graph(bridge), graph(null), graph(other), graph(null), graph(bridge)];
};

/** Each strand has independent topology; geometric crossings are overpasses. */
export const mouseGraph = function(difficulty: Difficulty, random: () => number): PathGraph {
	const lanes = sizes[difficulty];
	const stages = {easy: 2, medium: 3, hard: 4, insane: 5}[difficulty];
	const connected = sample(random) < 0.5;
	const nodes: GraphNode[] = [];
	const edges: Passage[] = [];
	const y = function(lane: number): number { return 15 + lane * 70 / (lanes - 1); };
	for (let col = 0; col <= stages; col += 1) {
		for (let lane = 0; lane < lanes; lane += 1) nodes.push({id: `${col}:${lane}`, x: 12 + col * 76 / stages, y: y(lane)});
	}
	let mouseLane = Math.floor(lanes / 2);
	const start = `0:${mouseLane}`;
	const goalLane = mouseLane;
	for (let col = 0; col < stages; col += 1) {
		const permutation = Array.from({length: lanes}, function(_, lane) { return lane; });
		for (let i = lanes - 1; i > 0; i -= 1) {
			const j = Math.floor(sample(random) * (i + 1));
			const a = permutation[i]; const b = permutation[j];
			if (a === undefined || b === undefined) throw new Error('Invalid strand');
			permutation[i] = b; permutation[j] = a;
		}
		if (col === stages - 1) {
			const target = connected ? goalLane : (goalLane + 1) % lanes;
			const swap = permutation.indexOf(target);
			const previous = permutation[mouseLane];
			if (previous === undefined) throw new Error('Missing mouse strand');
			permutation[swap] = previous; permutation[mouseLane] = target;
		}
		for (const [lane, next] of permutation.entries()) {
			const x1 = 12 + col * 76 / stages; const x2 = 12 + (col + 1) * 76 / stages;
			edges.push({from: `${col}:${lane}`, to: `${col + 1}:${next}`, curve: [{x: x1 + (x2 - x1) * 0.7, y: y(lane)}, {x: x2 - (x2 - x1) * 0.7, y: y(next)}]});
		}
		const nextMouse = permutation[mouseLane];
		if (nextMouse === undefined) throw new Error('Missing mouse route');
		mouseLane = nextMouse;
	}
	// A visible smooth loop and two dead-end branches, present for both truths.
	const anchor = nodes.find(function(node) { return node.id === '1:0'; });
	if (anchor === undefined) throw new Error('Missing junction');
	nodes.push({id: 'loop', x: anchor.x + 2, y: 5}, {id: 'dead', x: anchor.x - 7, y: 1});
	edges.push({from: anchor.id, to: 'loop', curve: [{x: anchor.x + 13, y: 17}, {x: anchor.x + 12, y: 2}]}, {from: 'loop', to: anchor.id, curve: [{x: anchor.x - 10, y: 2}, {x: anchor.x - 12, y: 13}]}, {from: 'loop', to: 'dead'});
	return {nodes, edges, start, goal: `${stages}:${goalLane}`, crossing: 'bridge'};
};
