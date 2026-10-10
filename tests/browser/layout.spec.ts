import {expect, test, type Page, type TestInfo} from '@playwright/test';

const capture = async function(page: Page, info: TestInfo, name: string): Promise<void> {
	const path = info.outputPath(`${name}.png`);
	await page.screenshot({path});
	await info.attach(name, {path, contentType: 'image/png'});
};
const checkLayout = async function(page: Page): Promise<void> {
	const copies = page.locator('.status-copy:visible');
	if (await copies.count() === 2) {
		await expect(page.locator('.far-text')).toHaveCSS('transform', 'matrix(-1, 0, 0, -1, 0, 0)');
		for (const selector of ['.title', '.description', '.countdown', '.timing', '.results']) {
			await expect(page.locator(`.far-text ${selector}`)).toHaveText(await page.locator(`.near-text ${selector}`).textContent() ?? '');
		}
	}
	const layout = await page.evaluate(function() {
		const bounds = function(element: Element) {
			const rect = element.getBoundingClientRect();
			return {x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height};
		};
		const visible = function(element: Element): boolean { return element.getClientRects().length > 0; };
		const controls = Array.from(document.querySelectorAll('.player-control')).filter(visible).map(bounds);
		const center = document.querySelector('.center');
		if (center === null) throw new Error('Missing game center');
		const content = [...Array.from(center.querySelectorAll('.status-copy > *, .actions, .toolbar, .target, .hint')), ...Array.from(document.querySelectorAll('.table > .score'))].filter(visible).map(bounds).filter(function(box) { return box.height > 0; });
		const intersects = function(a: ReturnType<typeof bounds>, b: ReturnType<typeof bounds>): boolean {
			return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
		};
		const padsOverlap = controls.some(function(a, index) { return controls.slice(index + 1).some(function(b) { return intersects(a, b); }); });
		const contentOverlap = content.some(function(a, index) { return content.slice(index + 1).some(function(b) { return intersects(a, b); }); });
		const overlap = content.some(function(box) {
			return controls.some(function(control) { return box.x < control.right && box.right > control.x && box.y < control.bottom && box.bottom > control.y; });
		});
		const outside = [...content, ...controls].some(function(box) { return box.x < 0 || box.y < 0 || box.right > innerWidth || box.bottom > innerHeight; });
		const controlContentOutside = Array.from(document.querySelectorAll('.player-control')).filter(visible).some(function(control) {
			const outer = bounds(control);
			return Array.from(control.children).some(function(child) {
				const inner = bounds(child);
				return inner.x < outer.x || inner.right > outer.right || inner.y < outer.y || inner.bottom > outer.bottom;
			});
		});
		return {overlap, padsOverlap, contentOverlap, outside, controlContentOutside, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, width: innerWidth, height: innerHeight, controls};
	});
	expect(layout.overlap).toBe(false);
	expect(layout.padsOverlap).toBe(false);
	expect(layout.contentOverlap).toBe(false);
	expect(layout.outside).toBe(false);
	expect(layout.controlContentOutside).toBe(false);
	expect(layout.scrollWidth).toBe(layout.width);
	expect(layout.scrollHeight).toBe(layout.height);
	for (const control of layout.controls) {
		expect(control.width).toBeGreaterThanOrEqual(112);
		expect(control.height).toBeGreaterThanOrEqual(104);
	}
};
const ready = async function(page: Page): Promise<void> {
	await page.evaluate(function() {
		for (const [index, element] of Array.from(document.querySelectorAll('.player-control')).entries()) {
			if (!(element instanceof HTMLButtonElement) || element.hidden) continue;
			element.dispatchEvent(new PointerEvent('pointerdown', {pointerId: index + 20, pointerType: 'touch', bubbles: true}));
			document.dispatchEvent(new PointerEvent('pointerup', {pointerId: index + 20, bubbles: true}));
		}
	});
};
const sizes = [
	{name: 'minimum-portrait', width: 320, height: 480, insets: {top: 0, right: 0, bottom: 0, left: 0}},
	{name: 'safe-area-portrait', width: 320, height: 600, insets: {top: 90, right: 0, bottom: 54, left: 0}},
	{name: 'safe-area-landscape', width: 620, height: 344, insets: {top: 24, right: 42, bottom: 24, left: 42}},
	{name: 'minimum-landscape', width: 560, height: 320},
	{name: 'phone-portrait', width: 390, height: 844},
	{name: 'phone-landscape', width: 844, height: 390},
	{name: 'tablet-portrait', width: 768, height: 1024},
	{name: 'tablet-landscape', width: 1024, height: 768},
];
for (const count of [2, 3, 4]) {
	for (const size of sizes) {
		test(`${count} players ${size.name} keeps all match surfaces clear of controls`, async function({page}, info) {
			await page.setViewportSize(size);
			await page.clock.install();
			await page.goto('/');
			if ('insets' in size) {
				await page.addStyleTag({content: `:root { --safe-top: ${size.insets.top}px; --safe-right: ${size.insets.right}px; --safe-bottom: ${size.insets.bottom}px; --safe-left: ${size.insets.left}px; }`});
			}
			await page.clock.pauseAt(new Date(Date.now() + 100));
			await checkLayout(page); await capture(page, info, 'setup');
			await page.getByRole('button', {name: `${count} players`, exact: true}).click({force: true});
			await page.getByRole('button', {name: 'Start match'}).click({force: true});
			await checkLayout(page); await capture(page, info, 'ready');
			await expect(page.locator('.player-control:visible')).toHaveCount(count);
			await expect(page.locator('.near-text .title')).toHaveText('Ready at your seat');
			await expect(page.locator('.far-text .title')).toHaveText('Ready at your seat');
			const seats = await page.locator('.player-control:visible').evaluateAll(function(elements) {
				return elements.map(function(element) {
					const box = element.getBoundingClientRect();
					const contents = element.querySelector('.control-content');
					if (!(element instanceof HTMLElement) || contents === null) throw new Error('Missing seat');
					return {player: element.getAttribute('aria-label'), far: box.y < innerHeight / 2, left: box.x < innerWidth / 2, width: box.width, rotation: getComputedStyle(contents).transform};
				});
			});
			for (const seat of seats) {
				const far = seat.player === 'Player 2 control' || seat.player === 'Player 3 control';
				expect(seat.far).toBe(far);
				expect(seat.rotation).toBe(far ? 'matrix(-1, 0, 0, -1, 0, 0)' : 'none');
				if (count === 2 || count === 3 && !far) expect(seat.width).toBe(size.width - ('insets' in size ? Math.max(12, size.insets.left) + Math.max(12, size.insets.right) : 24));
				else expect(seat.left).toBe(seat.player === 'Player 3 control' || seat.player === 'Player 4 control');
			}

			await ready(page);
			await page.clock.runFor(500);
			await expect(page.locator('.table')).toHaveAttribute('data-phase', 'countdown');
			await checkLayout(page); await capture(page, info, 'countdown');
			await page.getByRole('button', {name: 'Pause', exact: true}).click({force: true});
			await checkLayout(page); await capture(page, info, 'paused');
			await page.getByRole('button', {name: 'Resume', exact: true}).click({force: true});
			for (let round = 1; round <= 5; round++) {
				await ready(page);
				await page.clock.runFor(3020);
				await expect(page.locator('.table')).toHaveAttribute('data-phase', 'playing');
				if (round === 1) { await checkLayout(page); await capture(page, info, 'playing'); }
				await page.clock.fastForward(20_100);
				await expect(page.locator('.table')).toHaveAttribute('data-phase', round === 5 ? 'match-results' : 'round-results');
				await checkLayout(page);
				if (round === 1) await capture(page, info, 'round-results');
			}
			await capture(page, info, 'match-results');
			await expect(page.locator('.far-text .title')).toHaveText(await page.locator('.near-text .title').innerText());
		});
	}
}
for (const size of [{width: 319, height: 480}, {width: 320, height: 479}, {width: 559, height: 320}, {width: 560, height: 319}]) {
	test(`inadequate ${size.width}x${size.height} blocks starting`, async function({page}, info) {
		await page.setViewportSize(size); await page.goto('/');
		await expect(page.getByRole('button', {name: 'Start match'})).toBeDisabled();
		await expect(page.locator('.hint')).toContainText('Rotate or use a larger screen');
		await expect(page.locator('.table')).toHaveAttribute('data-phase', 'setup');
		await capture(page, info, 'inadequate');
	});
}
