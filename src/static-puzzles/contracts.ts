export const puzzleModeIds = ['sad-face', 'shape-count', 'equal-arrows', 'equal-t', 'equal-track-bars', 'four-in-a-line', 'alphabet-order', 'three-in-a-row', 'plus-and-minus'] as const;
export type PuzzleModeId = typeof puzzleModeIds[number];
export type Mark = 'A' | 'B' | null;
export type CountShape = 'circle' | 'square' | 'triangle';
export type Ink = 'red' | 'blue' | 'green';
export interface CountObject { readonly shape: CountShape; readonly color: Ink }
export interface Face { readonly sad: boolean; readonly rotation: number; readonly color: string }
export type Puzzle =
	| {readonly type: 'sad-face'; readonly columns: number; readonly faces: readonly Face[]}
	| {readonly type: 'shape-count'; readonly objects: readonly CountObject[]; readonly filter: CountObject; readonly operator: '<' | '>' | '='; readonly count: number}
	| {readonly type: 'equal-arrows'; readonly shafts: readonly [number, number]; readonly finAngle: number}
	| {readonly type: 'equal-t'; readonly barLength: number; readonly stemLength: number}
	| {readonly type: 'equal-track-bars'; readonly bars: readonly [{readonly left: number; readonly right: number}, {readonly left: number; readonly right: number}]; readonly convergence: number}
	| {readonly type: 'four-in-a-line' | 'three-in-a-row'; readonly columns: number; readonly rows: number; readonly cells: readonly Mark[]}
	| {readonly type: 'alphabet-order'; readonly letters: readonly string[]}
	| {readonly type: 'plus-and-minus'; readonly signs: readonly ('+' | '−')[]; readonly statement: 'More pluses' | 'More minuses' | 'The same number'};
