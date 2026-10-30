import type {Difficulty, SharedConfig, StimulusCore} from './mode';
export type PathTimeId = 'mouse-to-cheese' | 'countdown-to-zero' | 'colliding-shapes' | 'corner-to-corner';
export interface PathTimeConfig extends SharedConfig {
	readonly mode: PathTimeId;
	readonly difficulty: Difficulty;
	/** Optional collision controls, in diagram units/second and milliseconds. */
	readonly motionSpeed?: number;
	readonly overlapMs?: number;
}
export interface Point { readonly x: number; readonly y: number }
export interface GraphNode extends Point { readonly id: string }
export interface Passage {
	readonly from: string;
	readonly to: string;
	readonly curve?: readonly [Point, Point];
}
export interface PathGraph {
	readonly nodes: readonly GraphNode[];
	readonly edges: readonly Passage[];
	readonly start: string;
	readonly goal: string;
	/** Curves crossing away from shared node IDs never join. Later strands bridge earlier ones. */
	readonly crossing: 'bridge';
}
export interface MovingCircle extends Point { readonly radius: number }
export type PathTimeDrawing =
	| {readonly kind: 'countdown'; readonly digit: number}
	| {readonly kind: 'collision'; readonly circles: readonly [MovingCircle, MovingCircle]}
	| {readonly kind: 'maze'; readonly graph: PathGraph; readonly tokens: 'mouse-cheese' | 'corners'};
export type PathTimePlan =
	| {readonly kind: 'countdown'; readonly startDigit: number; readonly holdMs: number}
	| {readonly kind: 'collision'; readonly speed: number; readonly centerAt: number; readonly clearance: number; readonly radius: number; readonly vertical: boolean}
	| {readonly kind: 'maze'; readonly tokens: 'mouse-cheese' | 'corners'; readonly frames: readonly {readonly at: number; readonly graph: PathGraph}[]};
export interface PathTimeStimulus extends StimulusCore {
	readonly mode: PathTimeId;
	readonly showing: 'claim' | 'gap';
	readonly startedAt: number;
	readonly plan: PathTimePlan;
	readonly drawing: PathTimeDrawing;
}
