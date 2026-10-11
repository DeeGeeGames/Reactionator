import './style.css';
import {Game, type Phase} from './game';
import {attachPlayerInput} from './input';
import {type Presentation} from './mode';

const app = document.querySelector('#app');
if (!(app instanceof HTMLElement)) throw new Error('App container is missing');
const game = new Game(performance.now.bind(performance), Math.random);
const make = function<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag);
	element.className = className;
	element.textContent = text;
	return element;
};
const listenerCleanups: (() => void)[] = [];
const button = function(text: string, action: () => void): HTMLButtonElement {
	const element = make('button', 'action', text);
	element.type = 'button';
	element.addEventListener('click', action);
	listenerCleanups.push(function() { element.removeEventListener('click', action); });
	return element;
};
const table = make('main', 'table');
const center = make('section', 'center');
center.setAttribute('aria-label', 'Match status');
const eyebrow = make('p', 'eyebrow', 'ONE SCREEN · EVERYONE PLAYS');
const title = make('h1', 'title', 'Reaction mix');
const description = make('p', 'description');
const rules = make('div', 'rules');
for (const text of ['Every game appears once before any repeat.', 'Correct press: +1. Wrong or blank press: −1.', 'A blank false start locks you out of the next target. Release before pressing again.']) rules.append(make('p', '', text));
const choices = make('div', 'choices');
choices.setAttribute('role', 'group');
choices.setAttribute('aria-label', 'Player count');
const playerChoices = [2, 3, 4].map(function(count) {
	const choice = button(`${count} players`, function() { game.select(count); render(); });
	choices.append(choice);
	return {count, choice};
});
const boardSlot = make('div', 'board-slot');
const target = make('div', 'target');
target.setAttribute('aria-hidden', 'true');
boardSlot.append(target);
const countdown = make('p', 'countdown');
const nearPrompt = make('p', 'prompt');
const timing = make('p', 'timing');
const scoreTable = make('div', 'results');
const scoreRows = ([1, 2, 3, 4] as const).map(function(player) {
	const row = make('div', `result player-${player}`);
	const label = make('span', '', `P${player}`);
	const round = make('span', '');
	const total = make('strong', '');
	row.append(label, round, total);
	scoreTable.append(row);
	return {player, row, round, total};
});
const actions = make('div', 'actions');
const start = button('Start match', function() { if (layoutReady()) { game.start(); render(); } });
const resume = button('Resume', function() { if (layoutReady()) { game.resume(); render(); } });
const rematch = button('Rematch', function() { if (layoutReady()) { game.rematch(); render(); } });
const end = button('Change setup', function() { game.end(); render(); });
actions.append(start, resume, rematch, end);
const hint = make('p', 'hint');
const nearText = make('div', 'status-copy near-text');
nearText.append(eyebrow, title, description, rules, choices, countdown, nearPrompt, timing, scoreTable);
const farText = make('div', 'status-copy far-text');
// The far copy is visual repetition; assistive technology reads the near copy once.
farText.setAttribute('aria-hidden', 'true');
const farTitle = make('h1', 'title');
const farDescription = make('p', 'description');
const farCountdown = make('p', 'countdown');
const farPrompt = make('p', 'prompt');
const farTiming = make('p', 'timing');
const farScores = make('div', 'results');
const farScoreRows = scoreRows.map(function({player}) {
	const row = make('div', `result player-${player}`);
	const label = make('span', '', `P${player}`);
	const round = make('span', '');
	const total = make('strong', '');
	row.append(label, round, total);
	farScores.append(row);
	return {player, row, round, total};
});
farText.append(farTitle, farDescription, farCountdown, farPrompt, farTiming, farScores);
center.append(farText, nearText, boardSlot, actions, hint);
const toolbar = make('div', 'toolbar');
const pause = button('Pause', function() { interrupt('Match paused.'); });
const fullscreen = button('Fullscreen', function() {
	if (document.fullscreenElement !== null) void document.exitFullscreen().catch(function() {});
	else void table.requestFullscreen().catch(function() { hint.textContent = 'Fullscreen is unavailable. You can keep playing here.'; });
});
fullscreen.hidden = !document.fullscreenEnabled;
toolbar.append(pause, fullscreen);
const controls = ([1, 2, 3, 4] as const).map(function(player) {
	const element = make('button', `player-control player-${player}`);
	element.type = 'button';
	element.setAttribute('aria-label', `Player ${player} control`);
	const contents = make('span', 'control-content');
	const identity = make('span', 'identity', `Player ${player}`);
	const score = make('strong', `score player-${player}`, '0');
	score.setAttribute('aria-label', `Player ${player} round score`);
	table.append(score);
	const status = make('span', 'control-status');
	const feedback = make('span', 'feedback');
	contents.append(identity, status, feedback);
	element.append(contents);
	table.append(element);
	return {player, element, score, status, feedback};
});
center.append(toolbar);
table.append(center);
app.append(table);
let disposed = false;
let settled = true;
let focused = document.hasFocus();
let settleTimer: ReturnType<typeof setTimeout> | undefined;
let lastPhase: Phase = game.state.phase;
let viewport = {width: window.innerWidth, height: window.innerHeight};
// Controls retain at least 112 x 104px with room for the shared center.
const adequateViewport = function(): boolean {
	const padding = getComputedStyle(table);
	const extraInset = function(value: string): number { return Math.max(0, parseFloat(value) - 12); };
	const width = window.innerWidth - extraInset(padding.paddingLeft) - extraInset(padding.paddingRight);
	const height = window.innerHeight - extraInset(padding.paddingTop) - extraInset(padding.paddingBottom);
	return window.innerWidth >= window.innerHeight ? width >= 560 && height >= 320 : width >= 320 && height >= 480;
};
const layoutReady = function(): boolean { return adequateViewport() && settled && focused && !document.hidden; };
const attachInput = function() { return attachPlayerInput(controls, function(player) {
	if (!layoutReady()) return;
	game.press(player);
	// Commit a claimed white immediately, before another pointerdown can score.
	render();
}); };
let input = attachInput();
const show = function(element: HTMLElement, visible: boolean): void { element.hidden = !visible; };
const render = function(): void {
	const state = game.state;
	if (state.phase !== lastPhase) { input.invalidate(); lastPhase = state.phase; }
	const setup = state.phase === 'setup';
	const ready = state.phase === 'ready';
	const playing = state.phase === 'playing';
	const counting = state.phase === 'countdown';
	const paused = state.phase === 'paused';
	const roundResults = state.phase === 'round-results';
	const matchResults = state.phase === 'match-results';
	const results = roundResults || matchResults;
	table.dataset.phase = state.phase;
	table.dataset.players = String(state.players.length);
	table.dataset.inadequate = String(!adequateViewport());
	const high = Math.max(...state.players.map(function(player) { return state.scores.total[player]; }));
	const winners = state.players.filter(function(player) { return state.scores.total[player] === high; });
	const presentation: Presentation = playing && state.stimulus !== null ? game.mode.present(state.stimulus) : {kind: 'blank', prompt: ''};
	title.textContent = setup ? 'Reaction mix' : paused ? 'Paused'
		: roundResults ? `Round ${state.round} complete` : matchResults
			? `${winners.map(function(player) { return `P${player}`; }).join(' + ')} ${winners.length > 1 ? 'tie' : 'wins'}` : game.mode.name;
	description.textContent = setup ? `${game.match.rounds} random rounds. Choose 2–4 players.` : paused ? state.pauseReason
		: ready || counting ? `${game.mode.rules[0] ?? ''}${ready ? ' Each player: press your control when ready.' : ''}`
			: roundResults ? 'Everyone press your control when ready for the next round.'
				: matchResults ? `${game.match.rounds} rounds played. ${winners.length > 1 ? 'Shared victory.' : 'Match complete.'}` : '';
	show(eyebrow, setup); show(title, !playing); show(description, setup || paused || ready || counting || results);
	show(rules, setup); show(choices, setup); show(countdown, counting); show(target, playing && presentation.kind !== 'blank');
	show(nearPrompt, playing && presentation.prompt !== '');
	show(farPrompt, playing && presentation.prompt !== '');
	show(timing, playing || counting); show(scoreTable, results); show(start, setup); show(resume, paused);
	show(rematch, matchResults); show(end, paused || matchResults); show(actions, setup || paused || matchResults);
	show(pause, !setup && !paused && !matchResults);
	show(fullscreen, setup && document.fullscreenEnabled);
	end.textContent = paused ? 'End match' : 'Change setup';
	start.disabled = !layoutReady(); resume.disabled = !layoutReady(); rematch.disabled = !layoutReady();
	for (const {count, choice} of playerChoices) choice.setAttribute('aria-pressed', String(count === state.players.length));
	countdown.textContent = String(state.countdown);
	timing.textContent = `ROUND ${state.round} / ${game.match.rounds} · ${(state.remaining / 1000).toFixed(1)}s`;
	table.dataset.board = playing ? presentation.kind : '';
	table.dataset.prompt = playing && presentation.prompt !== '' ? 'both' : '';
	nearPrompt.textContent = presentation.prompt;
	farPrompt.textContent = presentation.prompt;
	paintBoard(playing ? presentation : {kind: 'blank', prompt: ''});
	hint.textContent = !adequateViewport() ? 'Rotate or use a larger screen to play. Minimum 320 × 480 portrait or 560 × 320 landscape.'
		: !settled ? 'Waiting for the layout to settle…' : !focused || document.hidden ? 'Return to this window to continue.'
			: setup && state.players.length === 4 ? 'For four players, landscape gives everyone more room.' : '';
	show(hint, hint.textContent !== '');
	for (const control of controls) {
		const active = state.players.includes(control.player);
		show(control.element, active && !setup);
		control.element.setAttribute('aria-disabled', String(!layoutReady() || !(ready || playing || roundResults)));
		show(control.score, active && !setup);
		control.score.textContent = String(state.scores.round[control.player]);
		const side = control.player === 2 || control.player === 3 ? 'far' : 'near';
		control.element.dataset.side = side;
		control.score.dataset.side = side;
		control.status.textContent = ready || roundResults ? state.ready.includes(control.player) ? 'READY ✓' : 'PRESS TO READY' : `TOTAL ${state.scores.total[control.player]}`;
		control.feedback.textContent = state.feedback?.player === control.player ? state.feedback.delta > 0 ? '+1' : '−1' : '';
		control.element.dataset.feedback = state.feedback?.player === control.player ? state.feedback.delta > 0 ? 'positive' : 'negative' : '';
		control.element.dataset.ready = String(state.ready.includes(control.player));
		control.element.dataset.winner = String(matchResults && winners.includes(control.player));
	}
	for (const row of scoreRows) {
		show(row.row, state.players.includes(row.player));
		row.round.textContent = `Round ${state.scores.round[row.player]}`;
		row.total.textContent = `Total ${state.scores.total[row.player]}`;
	}
	show(farText, (!setup && !playing) || (playing && presentation.prompt !== ''));
	show(farTitle, !playing);
	farTitle.textContent = title.textContent;
	farDescription.textContent = description.textContent;
	farCountdown.textContent = countdown.textContent;
	farTiming.textContent = timing.textContent;
	show(farDescription, !description.hidden);
	show(farCountdown, counting); show(farTiming, counting); show(farScores, results);
	for (const {player, row, round, total} of farScoreRows) {
		show(row, state.players.includes(player));
		round.textContent = `Round ${state.scores.round[player]}`;
		total.textContent = `Total ${state.scores.total[player]}`;
	}
};
const interrupt = function(reason: string): void { game.pause(reason); input.invalidate(); render(); };
const settleLayout = function(reason: string): void {
	settled = false;
	interrupt(reason);
	if (settleTimer !== undefined) clearTimeout(settleTimer);
	settleTimer = setTimeout(function() { settled = true; settleTimer = undefined; render(); }, 300);
};
const onResize = function(): void {
	const next = {width: window.innerWidth, height: window.innerHeight};
	const substantial = Math.abs(next.width - viewport.width) >= 32 || Math.abs(next.height - viewport.height) >= 48
		|| (next.width >= next.height) !== (viewport.width >= viewport.height);
	if (substantial || !adequateViewport() || !settled) settleLayout('Screen size changed. Ready again once everyone can reach their seat.');
	if (substantial) viewport = next;
	render();
};
const onOrientation = function(): void { viewport = {width: window.innerWidth, height: window.innerHeight}; settleLayout('Screen rotated. Check your seats before resuming.'); };
const onVisibility = function(): void { if (document.hidden) interrupt('The game was hidden.'); else render(); };
const onBlur = function(): void { focused = false; interrupt('The game lost focus.'); };
const onFocus = function(): void { focused = true; render(); };
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onOrientation);
window.addEventListener('blur', onBlur);
window.addEventListener('focus', onFocus);
document.addEventListener('visibilitychange', onVisibility);
let frameId = 0;
let boardSignature = '';
const paintBoard = function(presentation: Presentation): void {
	const signature = presentation.kind === 'glyphs'
		? `glyphs:${presentation.columns}:${presentation.rows}:${presentation.cells.map(function(cell) { return `${cell.shape}/${cell.color}/${cell.detail}`; }).join(',')}`
		: presentation.kind === 'swatch' ? `swatch:${presentation.color}` : 'blank';
	if (signature === boardSignature) return;
	boardSignature = signature;
	target.replaceChildren();
	target.style.removeProperty('--columns');
	target.style.removeProperty('--rows');
	if (presentation.kind === 'swatch') {
		target.dataset.board = 'swatch';
		target.dataset.color = presentation.color;
		return;
	}
	target.dataset.color = 'blank';
	if (presentation.kind === 'blank') {
		target.dataset.board = 'blank';
		return;
	}
	target.dataset.board = 'glyphs';
	target.style.setProperty('--columns', String(presentation.columns));
	target.style.setProperty('--rows', String(presentation.rows));
	for (const cell of presentation.cells) {
		const glyph = make('span', 'glyph');
		glyph.dataset.shape = cell.shape;
		glyph.dataset.color = cell.color;
		glyph.dataset.detail = cell.detail;
		target.append(glyph);
	}
};
let cacheSuspended = false;
const frame = function(): void {
	if (disposed || cacheSuspended) return;
	if (layoutReady()) game.frame();
	render();
	frameId = requestAnimationFrame(frame);
};
const dispose = function(): void {
	if (disposed) return;
	disposed = true;
	cancelAnimationFrame(frameId);
	if (settleTimer !== undefined) clearTimeout(settleTimer);
	input.dispose();
	for (const cleanup of listenerCleanups) cleanup();
	window.removeEventListener('resize', onResize);
	window.removeEventListener('orientationchange', onOrientation);
	window.removeEventListener('blur', onBlur);
	window.removeEventListener('focus', onFocus);
	window.removeEventListener('pagehide', onPageHide);
	window.removeEventListener('pageshow', onPageShow);
	document.removeEventListener('visibilitychange', onVisibility);
};
const onPageHide = function(event: PageTransitionEvent): void {
	if (!event.persisted) { dispose(); return; }
	if (cacheSuspended) return;
	cacheSuspended = true;
	interrupt('The game was left. Ready again after returning.');
	// Navigation ends this document's pointer stream; releases while cached are unobservable.
	input.dispose();
	cancelAnimationFrame(frameId);
	if (settleTimer !== undefined) clearTimeout(settleTimer);
	settleTimer = undefined;
	settled = false;
};
const onPageShow = function(event: PageTransitionEvent): void {
	if (!event.persisted || disposed || !cacheSuspended) return;
	cacheSuspended = false;
	input = attachInput();
	focused = document.hasFocus();
	viewport = {width: window.innerWidth, height: window.innerHeight};
	settleLayout('Returned to the game. Check your seats before resuming.');
	frameId = requestAnimationFrame(frame);
};
window.addEventListener('pagehide', onPageHide);
window.addEventListener('pageshow', onPageShow);
render();
frameId = requestAnimationFrame(frame);

if (import.meta.hot !== undefined) import.meta.hot.dispose(function() { dispose(); app.replaceChildren(); });
