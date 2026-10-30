import type {Difficulty} from '../mode';
import {sample} from '../mode';
import type {Mark, Puzzle} from './contracts';
import {integer, pick} from './random';
type Board = Extract<Puzzle, {type: 'four-in-a-line' | 'three-in-a-row'}>;
export const winningCells = function(board: Board): readonly number[] {
	const length = board.type === 'three-in-a-row' ? 3 : 4;
	const lines: number[] = [];
	for (let y = 0; y < board.rows; y++) for (let x = 0; x < board.columns; x++) {
		const mark = board.cells[y * board.columns + x];
		if (mark === null || mark === undefined) continue;
		for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]] as const) {
			const indices = Array.from({length}, function(_, step) { return {x: x + step * dx, y: y + step * dy}; });
			if (indices.every(function(p) { return p.x >= 0 && p.x < board.columns && p.y < board.rows && board.cells[p.y * board.columns + p.x] === mark; })) {
				lines.push(...indices.map(function(p) { return p.y * board.columns + p.x; }));
			}
		}
	}
	return [...new Set(lines)];
};
// Enumerate reachable states once. Recursion stops immediately at the first win.
const legalBoards = new Map<string, Board>();
const visit = function(cells: readonly Mark[], turn: 'A' | 'B'): void {
	const key = cells.map(function(mark) { return mark ?? '.'; }).join('');
	if (legalBoards.has(key)) return;
	const board: Board = {type: 'three-in-a-row', rows: 3, columns: 3, cells};
	legalBoards.set(key, board);
	if (winningCells(board).length > 0) return;
	for (const [index, cell] of cells.entries()) if (cell === null) visit(cells.map(function(value, i) { return i === index ? turn : value; }), turn === 'A' ? 'B' : 'A');
};
visit(Array.from({length: 9}, function() { return null; }), 'A');
export const isReachableThreeBoard = function(cells: readonly Mark[]): boolean {
	return cells.length === 9 && legalBoards.has(cells.map(function(mark) { return mark ?? '.'; }).join(''));
};
const threePools = new Map<string, readonly Board[]>();
export const generateThreeBoard = function(difficulty: Difficulty, random: () => number): Board {
	const truth = sample(random) < 0.5;
	const key = `${difficulty}:${truth}`;
	const cached = threePools.get(key);
	if (cached !== undefined) return pick(cached, random);
	const pool = [...legalBoards.values()].filter(function(board) {
		const won = winningCells(board).length > 0;
		const density = board.cells.filter(function(cell) { return cell !== null; }).length;
		if (truth !== won) return false;
		if (difficulty === 'easy') return density <= 6 && (!truth || [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8]].some(function(indices) {
			const marks = indices.map(function(index) { return board.cells[index]; });
			return marks[0] !== null && marks.every(function(mark) { return mark === marks[0]; });
		}));
		if (truth && (difficulty === 'hard' || difficulty === 'insane')) {
			const diagonal = [[0,4,8], [2,4,6]].some(function(indices) { return indices.every(function(index) { return board.cells[index] !== null && board.cells[index] === board.cells[4]; }); });
			if (!diagonal) return false;
		}
		return density >= (difficulty === 'medium' ? 4 : difficulty === 'hard' ? 6 : 7);
	});
	threePools.set(key, pool);
	return pick(pool, random);
};
const dimensions: Readonly<Record<Difficulty, readonly [number, number]>> = {easy: [5, 5], medium: [6, 6], hard: [7, 6], insane: [8, 7]};
export const generateFourBoard = function(difficulty: Difficulty, random: () => number): Board {
	const truth = sample(random) < 0.5;
	const [columns, rows] = dimensions[difficulty];
	const board: Board = {type: 'four-in-a-line', columns, rows, cells: []};
	for (let attempt = 0; attempt < 64; attempt++) {
		const density: Readonly<Record<Difficulty, number>> = {easy: 0.45, medium: 0.55, hard: 0.65, insane: 0.75};
		const cells = Array.from({length: rows * columns}, function(): Mark { return sample(random) < density[difficulty] ? pick(['A', 'B'] as const, random) : null; });
		if (truth) {
			const [dx, dy] = pick([[1, 0], [0, 1], [1, 1], [-1, 1]] as const, random);
			const x = dx < 0 ? 3 + integer(columns - 3, random) : integer(columns - 3 * dx, random);
			const y = integer(rows - 3 * dy, random);
			const mark = pick(['A', 'B'] as const, random);
			for (let step = 0; step < 4; step++) cells[(y + step * dy) * columns + x + step * dx] = mark;
		}
		const candidate = {...board, cells};
		if ((winningCells(candidate).length > 0) === truth) return candidate;
	}
	// Guaranteed false fallback for pathological injected sources; no unbounded retries.
	return {...board, cells: Array.from({length: rows * columns}, function() { return null; })};
};
