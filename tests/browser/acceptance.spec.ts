import {expect, test, type Page} from '@playwright/test';

const control = function(page: Page, player: number) { return page.getByRole('button', {name: `Player ${player} control`, exact: true}); };
const phase = function(page: Page) { return page.locator('main.table'); };
const pointer = async function(page: Page, player: number, type: string, pointerId = 100 + player): Promise<void> {
	await control(page, player).dispatchEvent(type, {pointerId, pointerType: 'touch', button: 0, bubbles: true});
};
const tap = async function(page: Page, player: number): Promise<void> {
	await pointer(page, player, 'pointerdown');
	await pointer(page, player, 'pointerup');
};
const open = async function(page: Page, count = 2): Promise<void> {
	await page.goto('/');
	await page.bringToFront();
	await expect.poll(function() { return page.evaluate(function() { return document.hasFocus(); }); }).toBe(true);
	await page.getByRole('button', {name: `${count} players`, exact: true}).click();
	await page.getByRole('button', {name: 'Start match', exact: true}).click();
	await expect(phase(page)).toHaveAttribute('data-phase', 'ready');
};
const ready = async function(page: Page, players: readonly number[]): Promise<void> {
	for (const player of players) await tap(page, player);
	await expect(phase(page)).toHaveAttribute('data-phase', 'countdown');
};
const wrongPressAll = async function(page: Page, players: readonly number[]): Promise<void> {
	// Observe the color and commit all presses in one browser task to avoid a
	// color transition between separate protocol reads and input dispatch.
	await page.waitForFunction(function(ids) {
		const target = document.querySelector('.target');
		const table = document.querySelector('main.table');
		if (!(target instanceof HTMLElement) || !(table instanceof HTMLElement)
			|| table.dataset.phase !== 'playing' || target.dataset.color === 'white') return false;
		for (const player of ids) {
			const element = document.querySelector(`.player-control.player-${player}`);
			if (!(element instanceof HTMLElement)) throw new Error('Missing player control');
			element.dispatchEvent(new PointerEvent('pointerdown', {pointerId: 100 + player, pointerType: 'touch', bubbles: true}));
			element.dispatchEvent(new PointerEvent('pointerup', {pointerId: 100 + player, pointerType: 'touch', bubbles: true}));
		}
		return true;
	}, players);

};

for (const {count, players} of [
	{count: 2, players: [1, 2]},
	{count: 3, players: [1, 2, 3]},
	{count: 4, players: [1, 2, 3, 4]},
]) {
	test(`${count} players complete five real-time rounds, tie, and reset`, async function({page}) {
		await open(page, count);
		await expect(page.locator('.player-control:visible')).toHaveCount(count);
		await control(page, players[0] ?? 1).dispatchEvent('click');
		await expect(phase(page)).toHaveAttribute('data-phase', 'ready');
		const started = Date.now();
		for (let round = 1; round <= 5; round += 1) {
			const first = players[0];
			if (first === undefined) throw new Error('Empty roster');
			await tap(page, first);
			await tap(page, first);
			await expect(phase(page)).toHaveAttribute('data-phase', round === 1 ? 'ready' : 'round-results');
			await expect(control(page, first)).toHaveAttribute('data-ready', 'true');
			for (const player of players.slice(1)) await tap(page, player);
			await expect(phase(page)).toHaveAttribute('data-phase', 'countdown');
			await expect(page.locator('.near-text .countdown')).toHaveText(/^[123]$/);
			for (const player of players) await expect(page.locator(`.score.player-${player}`)).toHaveText('0');
			await expect(phase(page)).toHaveAttribute('data-phase', 'playing', {timeout: 5_000});
			await wrongPressAll(page, players);
			for (const player of players) await expect(page.locator(`.score.player-${player}`)).toHaveText('-1');
			await expect(phase(page)).toHaveAttribute('data-phase', round === 5 ? 'match-results' : 'round-results', {timeout: 23_000});
			for (const player of players) {
				await expect(page.locator(`.near-text .result.player-${player}`)).toHaveText(`P${player}Round -1Total -${round}`);
			}
			console.log(`${count} players: real-time round ${round} complete`);
		}
		expect(Date.now() - started).toBeGreaterThanOrEqual(110_000);
		await expect(page.getByRole('heading')).toHaveText(`${players.map(function(player) { return `P${player}`; }).join(' + ')} tie`);
		await expect(page.locator('.near-text .description')).toHaveText('5 rounds played. Shared victory.');
		for (const player of players) await expect(control(page, player)).toHaveAttribute('data-winner', 'true');
		await page.getByRole('button', {name: 'Rematch', exact: true}).click();
		await expect(phase(page)).toHaveAttribute('data-phase', 'ready');
		for (const player of players) {
			await expect(page.locator(`.score.player-${player}`)).toHaveText('0');
			await expect(control(page, player)).toHaveAttribute('data-ready', 'false');
		}
		await page.getByRole('button', {name: 'Pause', exact: true}).click();
		await page.getByRole('button', {name: 'End match', exact: true}).click();
		await expect(phase(page)).toHaveAttribute('data-phase', 'setup');
		await expect(page.getByRole('button', {name: `${count} players`, exact: true})).toHaveAttribute('aria-pressed', 'true');
	});
}

test.describe('controlled browser lifecycle and pointer events', function() {
	test.beforeEach(async function({page}) {
		await page.clock.install();
		await page.clock.pauseAt(new Date(Date.now() + 1_000));
		await open(page);
	});

	test('pause preserves scores/time and resumes with all-player readiness and fresh gap', async function({page}) {
		await ready(page, [1, 2]);
		await page.clock.runFor(3_050);
		await wrongPressAll(page, [1, 2]);
		await page.clock.runFor(2_000);
		await page.getByRole('button', {name: 'Pause', exact: true}).click();
		await expect(phase(page)).toHaveAttribute('data-phase', 'paused');
		const beforePause = await page.locator('.near-text .timing').textContent();
		await page.clock.runFor(30_000);
		await page.getByRole('button', {name: 'Resume', exact: true}).click();
		await expect(phase(page)).toHaveAttribute('data-phase', 'ready');
		await tap(page, 1);
		await expect(phase(page)).toHaveAttribute('data-phase', 'ready');
		await tap(page, 2);
		await page.clock.runFor(3_050);
		await expect(phase(page)).toHaveAttribute('data-phase', 'playing');
		await expect(page.locator('.target')).toHaveAttribute('data-color', 'blank');
		const afterResume = await page.locator('.near-text .timing').textContent();
		const beforeSeconds = Number(beforePause?.match(/([\d.]+)s$/)?.[1]);
		const afterSeconds = Number(afterResume?.match(/([\d.]+)s$/)?.[1]);
		expect(Number.isFinite(beforeSeconds) && Number.isFinite(afterSeconds)).toBe(true);
		// The resumed RAF may consume up to one displayed tenth; the thirty-second
		// pause and fresh three-second countdown must consume no playing time.
		expect(beforeSeconds - afterSeconds).toBeGreaterThanOrEqual(0);
		expect(beforeSeconds - afterSeconds).toBeLessThanOrEqual(0.11);
		for (const player of [1, 2]) await expect(page.locator(`.score.player-${player}`)).toHaveText('-1');
	});

	test('resize and orientation wait for settling and clear readiness', async function({page}) {
		await tap(page, 1);
		await page.setViewportSize({width: 700, height: 1100});
		await page.clock.runFor(20);
		await expect(phase(page)).toHaveAttribute('data-phase', 'paused');
		await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeDisabled();
		await page.clock.runFor(350);
		await page.getByRole('button', {name: 'Resume', exact: true}).click();
		await expect(control(page, 1)).toHaveAttribute('data-ready', 'false');
		await ready(page, [1, 2]);
		await page.evaluate(function() { window.dispatchEvent(new Event('orientationchange')); });
		await expect(phase(page)).toHaveAttribute('data-phase', 'paused');
		await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeDisabled();
		await page.clock.runFor(350);
		await page.getByRole('button', {name: 'Resume', exact: true}).click();
		await ready(page, [1, 2]);
		await page.clock.runFor(3_050);
		await expect(page.locator('.target')).toHaveAttribute('data-color', 'blank');
	});

	test('held pointers never replay; cancellation and capture loss allow fresh presses', async function({page}) {
		await pointer(page, 1, 'pointerdown');
		await tap(page, 2);
		await pointer(page, 1, 'pointerdown');
		await page.clock.runFor(3_050);
		await expect(page.locator('.score.player-1')).toHaveText('0');
		await pointer(page, 1, 'pointerdown');
		await expect(page.locator('.score.player-1')).toHaveText('0');
		await pointer(page, 1, 'pointercancel');
		await tap(page, 1);
		await expect(page.locator('.score.player-1')).toHaveText('-1');
		await page.getByRole('button', {name: 'Pause', exact: true}).click();
		await page.getByRole('button', {name: 'Resume', exact: true}).click();
		await pointer(page, 1, 'pointerdown');
		await page.getByRole('button', {name: 'Pause', exact: true}).click();
		await page.getByRole('button', {name: 'Resume', exact: true}).click();
		await pointer(page, 1, 'pointerdown');
		await expect(control(page, 1)).toHaveAttribute('data-ready', 'false');
		await pointer(page, 1, 'lostpointercapture');
		await tap(page, 1);
		await expect(control(page, 1)).toHaveAttribute('data-ready', 'true');
		await expect(phase(page)).toHaveAttribute('data-phase', 'ready');
		await tap(page, 2);
		await expect(phase(page)).toHaveAttribute('data-phase', 'countdown');
	});

	test('persisted page lifecycle recreates input and discards obsolete holds', async function({page}) {
		await pointer(page, 1, 'pointerdown');
		await page.evaluate(function() { window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted: true})); });
		await expect(phase(page)).toHaveAttribute('data-phase', 'paused');
		await page.evaluate(function() { window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true})); });
		await page.clock.runFor(350);
		await page.getByRole('button', {name: 'Resume', exact: true}).click();
		await ready(page, [1, 2]);
		await page.clock.runFor(3_050);
		await wrongPressAll(page, [1, 2]);
		for (const player of [1, 2]) await expect(page.locator(`.score.player-${player}`)).toHaveText('-1');
		await page.evaluate(function() { window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted: false})); });
		await tap(page, 1);
		await page.getByRole('button', {name: 'Pause', exact: true}).click();
		await page.clock.runFor(30_000);
		await expect(phase(page)).toHaveAttribute('data-phase', 'playing');
		await expect(page.locator('.score.player-1')).toHaveText('-1');
		await page.reload();
		await expect(phase(page)).toHaveAttribute('data-phase', 'setup');
	});
});

test('seeded committed white has one winner; match results allow changing players', async function({page}) {
	// Supply a valid deterministic random sample for this controlled scoring case.
	// The real-time roster journeys retain the browser's native randomness.
	await page.addInitScript(function() { Math.random = function() { return 0; }; });
	await page.clock.install();
	await page.clock.pauseAt(new Date(Date.now() + 1_000));
	await open(page);
	await ready(page, [1, 2]);
	await page.clock.runFor(3_050);
	await page.clock.runFor(500);
	await expect(page.locator('.target')).toHaveAttribute('data-color', 'white');
	await tap(page, 1);
	await expect(page.locator('.score.player-1')).toHaveText('1');
	await expect(control(page, 1)).toHaveCSS('background-color', 'rgb(19, 123, 54)');
	await expect(control(page, 2)).toHaveCSS('background-color', 'rgb(25, 30, 39)');
	await expect(control(page, 1).locator('.feedback')).toHaveText('+1');
	await tap(page, 2);
	await expect(control(page, 2)).toHaveCSS('background-color', 'rgb(181, 36, 36)');
	await expect(control(page, 1)).toHaveCSS('background-color', 'rgb(25, 30, 39)');
	await expect(control(page, 2).locator('.feedback')).toHaveText('−1');
	await expect(page.locator('.score.player-2')).toHaveText('-1');
	await expect(page.locator('.target')).toHaveAttribute('data-color', 'blank');
	await page.clock.runFor(700);
	await expect(control(page, 2)).toHaveCSS('background-color', 'rgb(25, 30, 39)');
	await page.clock.runFor(19_300);
	for (let round = 2; round <= 5; round += 1) {
		await ready(page, [1, 2]);
		await page.clock.runFor(23_100);
	}
	await expect(phase(page)).toHaveAttribute('data-phase', 'match-results');
	await expect(page.getByRole('heading')).toHaveText('P1 wins');
	await expect(control(page, 1)).toHaveAttribute('data-winner', 'true');
	await expect(control(page, 2)).toHaveAttribute('data-winner', 'false');
	await page.getByRole('button', {name: 'Change players', exact: true}).click();
	await expect(phase(page)).toHaveAttribute('data-phase', 'setup');
	await page.getByRole('button', {name: '3 players', exact: true}).click();
	await page.getByRole('button', {name: 'Start match', exact: true}).click();
	await expect(page.locator('.player-control:visible')).toHaveCount(3);
	for (const player of [1, 2, 3]) await expect(page.locator(`.score.player-${player}`)).toHaveText('0');
});

test('dispatched blur/focus lifecycle pauses and returns with fresh readiness', async function({page}) {
	await page.clock.install();
	await page.clock.pauseAt(new Date(Date.now() + 1_000));
	await open(page);
	await ready(page, [1, 2]);
	await page.clock.runFor(3_050);
	// Headless Chromium keeps document focus even when another page is activated.
	// Exercise the lifecycle handler; this does not claim operating-system blur evidence.
	await page.evaluate(function() { window.dispatchEvent(new Event('blur')); });
	await expect(phase(page)).toHaveAttribute('data-phase', 'paused');
	await expect(page.getByRole('button', {name: 'Resume', exact: true})).toBeDisabled();
	await page.clock.runFor(30_000);
	await page.evaluate(function() { window.dispatchEvent(new Event('focus')); });
	await page.getByRole('button', {name: 'Resume', exact: true}).click();
	await expect(phase(page)).toHaveAttribute('data-phase', 'ready');
	for (const player of [1, 2]) await expect(control(page, player)).toHaveAttribute('data-ready', 'false');
});

test('a mouse pointer sliding across seats retains its initial owner', async function({page}) {
	await page.clock.install();
	await page.clock.pauseAt(new Date(Date.now() + 1_000));
	await open(page);
	const near = await control(page, 1).boundingBox();
	const far = await control(page, 2).boundingBox();
	if (near === null || far === null) throw new Error('Missing seats');
	await page.mouse.move(near.x + near.width / 2, near.y + near.height / 2);
	await page.mouse.down();
	await page.mouse.move(far.x + far.width / 2, far.y + far.height / 2);
	await expect(control(page, 1)).toHaveAttribute('data-ready', 'true');
	await expect(control(page, 2)).toHaveAttribute('data-ready', 'false');
	await page.mouse.up();
	await page.mouse.down();
	await page.mouse.up();
	await expect(phase(page)).toHaveAttribute('data-phase', 'countdown');
});

for (const {sample, color, fill} of [
	{sample: 0.3, color: 'red', fill: 'rgb(255, 39, 39)'},
	{sample: 0.5, color: 'blue', fill: 'rgb(40, 97, 255)'},
	{sample: 0.8, color: 'green', fill: 'rgb(17, 201, 70)'},
]) {
	test(`wrong press fills only its pad and preserves the ${color} swatch`, async function({page}) {
		await page.addInitScript(function(value) { Math.random = function() { return value; }; }, sample);
		await page.clock.install();
		await page.clock.pauseAt(new Date(Date.now() + 1_000));
		await open(page, 4);
		await ready(page, [1, 2, 3, 4]);
		await page.clock.runFor(3_600);
		await expect(page.locator('.target')).toHaveAttribute('data-color', color);
		await tap(page, 3);
		await expect(control(page, 3)).toHaveCSS('background-color', 'rgb(181, 36, 36)');
		for (const player of [1, 2, 4]) await expect(control(page, player)).toHaveCSS('background-color', 'rgb(25, 30, 39)');
		await expect(page.locator('.target')).toHaveCSS('background-color', fill);
	});
}
