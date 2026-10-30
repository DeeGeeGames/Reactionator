export type FigureModeId = 'animal-silhouette' | 'flying-silhouette' | 'made-by-people' | 'panda-in-group';
export type FigureTag = 'animal' | 'canFly' | 'madeByPeople';
export type VectorPart =
	| {readonly kind: 'path'; readonly d: string; readonly fill: 'dark' | 'light'}
	| {readonly kind: 'ellipse'; readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number; readonly fill: 'dark' | 'light'};
export interface Figure {
	readonly id: string; readonly description: string;
	readonly animal: boolean; readonly canFly: boolean; readonly madeByPeople: boolean;
	readonly drawing: readonly VectorPart[];
}
export interface FigurePayload {
	readonly kind: 'figures'; readonly question: FigureModeId;
	readonly figures: readonly Figure[]; readonly columns: number; readonly rows: number;
}
export interface FigurePresentation {readonly kind: 'figures'; readonly prompt: string; readonly payload: FigurePayload}
