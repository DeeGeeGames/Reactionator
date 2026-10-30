import type {CountryPresentation, Flag} from './country-types';
import type {Figure, FigurePresentation} from './figure-types';
import './family-style.css';
const ns = 'http://www.w3.org/2000/svg';
const flagDrawing = function(flag: Flag): SVGSVGElement {
	const svg = document.createElementNS(ns, 'svg');
	svg.setAttribute('viewBox', `0 0 ${flag.ratio * 100} 100`);
	svg.style.aspectRatio = String(flag.ratio);
	svg.classList.add('country-flag');
	const rectangle = function(x: number, y: number, width: number, height: number, color: string): void {
		const rect = document.createElementNS(ns, 'rect');
		for (const [key, value] of Object.entries({x, y, width, height, fill: color})) rect.setAttribute(key, String(value));
		svg.append(rect);
	};
	if (flag.kind === 'bands') {
		const vertical = flag.axis === 'vertical';
		flag.colors.forEach(function(color, i) { rectangle(vertical ? i * flag.ratio * 100 / flag.colors.length : 0,
			vertical ? 0 : i * 100 / flag.colors.length, vertical ? flag.ratio * 100 / flag.colors.length : flag.ratio * 100,
			vertical ? 100 : 100 / flag.colors.length, color); });
	} else {
		rectangle(0, 0, flag.ratio * 100, 100, flag.background);
		rectangle(flag.x, 0, flag.width, 100, flag.color); rectangle(0, 50 - flag.width / 2, flag.ratio * 100, flag.width, flag.color);
	}
	return svg;
};
export const figureDrawing = function(figure: Figure): SVGSVGElement {
	const svg = document.createElementNS(ns, 'svg');
	svg.setAttribute('viewBox', '0 0 100 100');
	// Deliberately omit names/tags from active drawings; descriptions remain in the catalog for QA.
	for (const part of figure.drawing) {
		const element = document.createElementNS(ns, part.kind);
		element.setAttribute('fill', part.fill === 'dark' ? '#20252c' : '#f4f1e8');
		if (part.kind === 'path') element.setAttribute('d', part.d);
		else for (const [key, value] of Object.entries({cx: part.cx, cy: part.cy, rx: part.rx, ry: part.ry})) element.setAttribute(key, String(value));
		svg.append(element);
	}
	return svg;
};
const label = function(content: string, className: string): HTMLElement { const span = document.createElement('span'); span.className = className; span.textContent = content; return span; };
export const paintFamilyBoard = function(target: HTMLElement, presentation: CountryPresentation | FigurePresentation): void {
	const key = JSON.stringify(presentation);
	if (target.dataset.content === key && target.dataset.board === presentation.kind) return;
	target.replaceChildren(); target.dataset.board = presentation.kind; target.dataset.color = 'blank'; target.dataset.content = key;
	for (const side of ['far', 'near']) {
		const copy = document.createElement('div'); copy.className = `family-copy family-${side}`;
		if (side === 'far') copy.setAttribute('aria-hidden', 'true');
		if (presentation.kind === 'country') {
			const {left, right, question} = presentation.payload;
			copy.append(label(left.name, 'country-name'));
			if (question === 'matching-flag') copy.append(flagDrawing(right.flag));
			else if (question === 'matching-capital') copy.append(label(right.capital, 'country-name'));
			else {
				copy.prepend(label(question === 'larger-population' ? 'POPULATION' : 'LAND AREA', 'country-metric'));
				copy.append(label('>', 'country-comparator'), label(right.name, 'country-name'));
			}
		} else {
			const {figures, columns, rows} = presentation.payload;
			copy.classList.add('figure-grid');
			copy.style.setProperty('--figure-columns', String(columns)); copy.style.setProperty('--figure-rows', String(rows));
			for (const figure of figures) copy.append(figureDrawing(figure));
		}
		target.append(copy);
	}
};
