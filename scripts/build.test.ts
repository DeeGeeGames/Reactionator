import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {describe, expect, test} from 'bun:test';
import {buildBrowser} from './build';
import {resolveDistFile} from './dist-path';

describe('production build', function() {
	test('emits relative asset URLs that stay inside the output directory', async function() {
		const outdir = await mkdtemp(resolve(tmpdir(), 'press-on-white-'));
		try {
			await buildBrowser({
				entrypoint: resolve(import.meta.dir, '../index.html'),
				outdir,
			});
			const html = await readFile(resolve(outdir, 'index.html'), 'utf8');
			const urls = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map(function(match) {
				const url = match[1];
				if (url === undefined) throw new Error('Missing asset URL');
				return url;
			});
			expect(urls.length).toBeGreaterThan(0);
			for (const url of urls) {
				expect(url.startsWith('/')).toBe(false);
				expect(url.includes('://')).toBe(false);
				const filePath = resolveDistFile(outdir, `/${url.replace(/^\.\//, '')}`);
				expect(filePath).not.toBeNull();
				if (filePath === null) throw new Error('Missing built file');
				expect(await Bun.file(filePath).exists()).toBe(true);
			}
			const bundled = await Array.fromAsync(new Bun.Glob('**/*.{html,css,js}').scan({cwd: outdir, onlyFiles: true}));
			expect(bundled.length).toBeGreaterThan(0);
			for (const file of bundled) {
				const text = await readFile(resolve(outdir, file), 'utf8');
				expect(text.includes('/_bun')).toBe(false);
				expect(text.includes('url(/')).toBe(false);
			}
		} finally {
			await rm(outdir, {recursive: true, force: true});
		}
	});
});
