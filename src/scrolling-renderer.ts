import type {ScrollingSymbol} from './mode';
import {drawSymbol} from './symbol-art';
import {scrollingIconWidth} from './scrolling-pair';

export const paintScrollingBoard = function(target: HTMLElement, items: readonly ScrollingSymbol[], highlights: readonly number[]): void {
	if (target.dataset.board !== 'scrolling-symbols') target.replaceChildren();
	target.dataset.board = 'scrolling-symbols'; target.dataset.color = 'blank'; target.dataset.content = 'scrolling-symbols';
	const existing = new Map(Array.from(target.children).flatMap(function(child): readonly (readonly [string, SVGSVGElement])[] {
		return child instanceof SVGSVGElement && child.dataset.item !== undefined ? [[child.dataset.item, child]] : [];
	}));
	let visibleIndex = 0;
	for (const item of items) {
		let icon = existing.get(item.id);
		if (icon !== undefined && icon.dataset.symbol !== item.kind) { icon.remove(); icon = undefined; }
		if (icon === undefined) {
			icon = drawSymbol(item.kind, item.artIndex);
			icon.classList.add('scrolling-symbol'); icon.dataset.item = item.id;
			icon.style.width = `${scrollingIconWidth}%`; icon.style.top = `${item.row * 50}%`;
			target.append(icon);
		}
		icon.style.left = `${item.x}%`;
		icon.dataset.row = String(item.row);
		icon.dataset.fullyVisible = String(item.fullyVisible);
		icon.setAttribute('aria-hidden', String(!item.fullyVisible));
		icon.dataset.highlighted = String(item.fullyVisible && highlights.includes(visibleIndex));
		if (item.fullyVisible) visibleIndex++;
		existing.delete(item.id);
	}
	for (const icon of existing.values()) icon.remove();
};
