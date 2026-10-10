import {mkdir, rm} from 'node:fs/promises';
import {resolve} from 'node:path';

export const buildBrowser = async function(options: {readonly entrypoint: string; readonly outdir: string}): Promise<void> {
	await rm(options.outdir, {recursive: true, force: true});
	await mkdir(options.outdir, {recursive: true});
	const result = await Bun.build({
		entrypoints: [options.entrypoint],
		outdir: options.outdir,
		minify: true,
		target: 'browser',
	});
	if (!result.success) {
		for (const log of result.logs) console.error(log);
		throw new Error('Browser bundle failed');
	}
};

if (import.meta.main) {
	await buildBrowser({
		entrypoint: resolve(import.meta.dir, '../index.html'),
		outdir: resolve(import.meta.dir, '../dist'),
	});
}
