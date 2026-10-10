import {defaults, emptyScores, pressOnWhite, reduceScore, roster, validateConfig, type Config, type ModeDefinition, type Player, type Scores, type Stimulus} from './mode';
export type Phase = 'setup' | 'ready' | 'countdown' | 'playing' | 'round-results' | 'match-results' | 'paused';
export interface GameState {
	readonly phase: Phase;
	readonly players: readonly Player[];
	readonly ready: readonly Player[];
	readonly round: number;
	readonly remaining: number;
	readonly countdown: number;
	readonly scores: Scores;
	readonly stimulus: Stimulus | null;
	readonly feedback: {readonly player: Player; readonly delta: number; readonly until: number} | null;
	readonly pauseReason: string;
}
export class Game {
	readonly config: Config;
	readonly mode: ModeDefinition;
	private stateValue: GameState;
	private lastTime: number;
	private countdownEnd = 0;
	private resumeRound = false;
	private session = 0;
	private identity = 0;
	private sequence = 0;
	constructor(private readonly clock: () => number, private readonly random: () => number, config: Config = defaults, mode: ModeDefinition = pressOnWhite) {
		this.config = validateConfig(config);
		if (mode.id !== config.mode) throw new Error('Mode does not match configuration');
		this.mode = mode;
		this.lastTime = clock();
		this.stateValue = this.initial(4);
	}
	get state(): GameState { return this.stateValue; }
	private initial(count: number): GameState {
		return {phase: 'setup', players: roster(count), ready: [], round: 1, remaining: this.config.roundMs,
			countdown: 3, scores: emptyScores(), stimulus: null, feedback: null, pauseReason: ''};
	}
	select(count: number): void {
		if (this.state.phase !== 'setup') return;
		this.stateValue = this.initial(count);
	}
	start(): void {
		if (this.state.phase !== 'setup') return;
		this.session += 1;
		this.resumeRound = false;
		this.stateValue = {...this.state, phase: 'ready', ready: []};
	}
	end(): void {
		this.session += 1;
		this.resumeRound = false;
		this.stateValue = this.initial(this.state.players.length);
	}
	rematch(): void { const count = this.state.players.length; this.end(); this.select(count); this.start(); }
	press(player: Player): void {
		if (!this.state.players.includes(player)) return;
		const now = this.clock();
		if (this.state.phase === 'ready' || this.state.phase === 'round-results') {
			if (this.state.ready.includes(player)) return;
			const ready = [...this.state.ready, player];
			this.stateValue = {...this.state, ready};
			if (ready.length === this.state.players.length) {
				if (this.state.phase === 'round-results') {
					this.stateValue = {...this.state, round: this.state.round + 1, remaining: this.config.roundMs,
						scores: {...this.state.scores, round: emptyScores().round}};
				}
				this.countdownEnd = now + this.config.countdownMs;
				this.stateValue = {...this.state, phase: 'countdown', countdown: Math.ceil(this.config.countdownMs / 1000), stimulus: null};
			}
			return;
		}
		if (this.state.phase !== 'playing') return;
		this.consumeTime(now);
		if (this.state.phase !== 'playing' || this.state.stimulus === null) return;
		// Input uses committed presentation, never advances a scheduled color.
		const outcome = this.mode.press(this.state.stimulus, {player, time: now}, this.config, this.random);
		if (outcome === null) return;
		const event = {id: `${this.session}:${this.state.round}:${outcome.identity}:${player}:${this.sequence++}`, player, delta: outcome.delta};
		this.identity = Math.max(this.identity, outcome.stimulus.id);
		this.stateValue = {...this.state, stimulus: outcome.stimulus, scores: reduceScore(this.state.scores, event, this.state.players),
			feedback: {player, delta: outcome.delta, until: now + 650}};
	}
	private consumeTime(now: number): void {
		const remaining = Math.max(0, this.state.remaining - Math.max(0, now - this.lastTime));
		this.lastTime = now;
		this.stateValue = {...this.state, remaining};
		if (remaining === 0) this.stateValue = {...this.state, phase: this.state.round === this.config.rounds ? 'match-results' : 'round-results', ready: [], stimulus: null, feedback: null};
	}
	frame(): void {
		const now = this.clock();
		if (this.state.phase === 'countdown' && now >= this.countdownEnd) {
			this.lastTime = now;
			this.stateValue = {...this.state, phase: 'playing', ready: [], stimulus: this.mode.create(now, ++this.identity, this.config, this.random)};
			this.resumeRound = false;
		} else if (this.state.phase === 'countdown') {
			this.stateValue = {...this.state, countdown: Math.ceil((this.countdownEnd - now) / 1000)};
		} else if (this.state.phase === 'playing') {
			this.consumeTime(now);
			if (this.state.phase === 'playing' && this.state.stimulus !== null) {
				const stimulus = this.mode.advance(this.state.stimulus, now, this.config, this.random);
				this.identity = Math.max(this.identity, stimulus.id);
				this.stateValue = {...this.state, stimulus};
			}
		}
		if (this.state.feedback !== null && now >= this.state.feedback.until) this.stateValue = {...this.state, feedback: null};
	}
	pause(reason: string): void {
		if (!['playing', 'countdown', 'ready', 'round-results'].includes(this.state.phase)) return;
		if (this.state.phase === 'playing') {
			this.consumeTime(this.clock());
			if (this.state.remaining === 0) return;
		}
		this.resumeRound = this.state.phase === 'playing' || this.resumeRound;
		this.stateValue = {...this.state, phase: 'paused', ready: [], stimulus: null, feedback: null, pauseReason: reason};
	}
	resume(): void {
		if (this.state.phase !== 'paused') return;
		// A completed round remains a results transition after interrupted readiness.
		this.stateValue = {...this.state, phase: this.state.remaining === 0 && !this.resumeRound ? 'round-results' : 'ready', ready: [], pauseReason: ''};
	}
}
