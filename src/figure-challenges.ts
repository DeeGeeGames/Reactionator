import {choose} from './country-challenges';
import type {Figure, FigureModeId, FigurePayload, FigureTag} from './figure-types';
import {sample, type Difficulty} from './mode';
import {figures} from './silhouettes';
import {createStaticMode} from './static-challenges';
export const figureTags = {'animal-silhouette': 'animal', 'flying-silhouette': 'canFly', 'made-by-people': 'madeByPeople'} as const;
export const pandaGrids: Readonly<Record<Difficulty, readonly [number, number]>> = {easy: [3, 3], medium: [4, 4], hard: [5, 4], insane: [6, 5]};
export const figurePool = function(tag: FigureTag, difficulty: Difficulty, truth: boolean): readonly Figure[] {
	const easy = ['sparrow', 'dog', 'fish', 'plane', 'hammer', 'tree', 'cup'];
	const near = ['sparrow', 'bat', 'butterfly', 'plane', 'helicopter', 'fish', 'bicycle', 'tree', 'cat', 'bear', 'panda'];
	return figures.filter(function(figure) { return figure[tag] === truth && (difficulty === 'easy' ? easy.includes(figure.id) : difficulty === 'medium' ? true : near.includes(figure.id)); });
};
export const figureClaimTrue = function(payload: FigurePayload): boolean {
	if (payload.question === 'panda-in-group') return payload.figures.some(function(figure) { return figure.id === 'panda'; });
	const first = payload.figures[0];
	if (first === undefined || payload.figures.length !== 1) throw new Error('Expected one figure');
	return first[figureTags[payload.question]];
};
export const generateFigures = function(question: FigureModeId, difficulty: Difficulty, random: () => number): FigurePayload {
	const truth = sample(random) < 0.5;
	if (question !== 'panda-in-group') return {kind: 'figures', question, columns: 1, rows: 1, figures: [choose(figurePool(figureTags[question], difficulty, truth), random)]};
	const [columns, rows] = pandaGrids[difficulty];
	const target = Math.floor(sample(random) * columns * rows);
	const distractors = figures.filter(function(figure) { return figure.animal && figure.id !== 'panda' && (difficulty !== 'easy' || figure.id !== 'bear'); });
	const panda = figures.find(function(figure) { return figure.id === 'panda'; });
	if (panda === undefined) throw new Error('Missing panda');
	return {kind: 'figures', question, columns, rows, figures: Array.from({length: columns * rows}, function(_, i) {
		const distractor = choose(distractors, random);
		return truth && i === target ? panda : distractor;
	})};
};
const definitions: readonly {readonly id: FigureModeId; readonly name: string; readonly prompt: string}[] = [
	{id: 'animal-silhouette', name: 'Animal Silhouette', prompt: 'Press if it is an animal.'},
	{id: 'flying-silhouette', name: 'Flying Silhouette', prompt: 'Press if it can fly.'},
	{id: 'made-by-people', name: 'Made by People', prompt: 'Press if people made it.'},
	{id: 'panda-in-group', name: 'Panda in the Group', prompt: 'Press if a panda is present.'},
];
export const figureModes = definitions.map(function({id, name, prompt}) {
	return createStaticMode({id, name, prompt, generate: function(difficulty, random) { return generateFigures(id, difficulty, random); },
		isTrue: function(payload) { return payload.kind === 'figures' && figureClaimTrue(payload); },
		explain: function(payload) {
			if (payload.kind !== 'figures') throw new Error('Expected figures');
			if (id === 'panda-in-group') return {message: figureClaimTrue(payload) ? 'A panda is present: look for round ears and dark eye patches.' : 'There is no panda in this group.'};
			const figure = payload.figures[0];
			if (figure === undefined) throw new Error('Missing figure');
			const property = id === 'animal-silhouette' ? 'an animal' : id === 'flying-silhouette' ? 'able to fly' : 'made by people';
			return {message: `The ${figure.id} is ${figureClaimTrue(payload) ? '' : 'not '}${property}.`};
		},
	});
});
