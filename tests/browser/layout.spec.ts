import {expect, test, type Page, type TestInfo} from '@playwright/test';

const capture = async function(page: Page, info: TestInfo, name: string): Promise<void> {
	const path = info.outputPath(`${name}.png`);
	await page.screenshot({path});
	await info.attach(name, {path, contentType: 'image/png'});
};
const checkLayout = async function(page: Page): Promise<void> {
	const layout = await page.evaluate(function() {
		const bounds = function(element: Element) {
			const rect = element.getBoundingClientRect();
			return {x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height};
		};
		const visible = function(element: Element): boolean { return getComputedStyle(element).display !== 'none'; };
		const controls = Array.from(document.querySelectorAll('.player-control')).filter(visible).map(bounds);
		const center = document.querySelector('.center');
		if (center === null) throw new Error('Missing game center');
		const content = Array.from(center.children).filter(visible).map(bounds).filter(function(box) { return box.height > 0; });
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
		return {overlap, outside, controlContentOutside, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, width: innerWidth, height: innerHeight, controls};
	});
	expect(layout.overlap).toBe(false);
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
	{name: 'minimum-portrait', width: 320, height: 480},
	{name: 'minimum-landscape', width: 560, height: 320},
	{name: 'phone-portrait', width: 390, height: 844},
	{name: 'phone-landscape', width: 844, height: 390},
	{name: 'tablet-portrait', width: 768, height: 1024},
	{name: 'tablet-landscape', width: 1024, height: 768},
];
for (const size of sizes) {
	test(`${size.name} keeps all match surfaces clear of controls`, async function({page}, info) {
		await page.setViewportSize(size);
		await page.clock.install();
		await page.goto('/');
		await page.clock.pauseAt(new Date(Date.now() + 100));
		await checkLayout(page); await capture(page, info, 'setup');
		await page.getByRole('button', {name: 'Start match'}).click({force: true});
		await checkLayout(page); await capture(page, info, 'ready');
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
	});
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
