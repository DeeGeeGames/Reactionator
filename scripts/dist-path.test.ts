import {resolve} from 'node:path';
import {describe, expect, test} from 'bun:test';
import {resolveDistFile} from './dist-path';

const root = resolve('/tmp/press-on-white-dist');

describe('production file paths', function() {
	test('serves index.html for the site root', function() {
		expect(resolveDistFile(root, '/')).toBe(resolve(root, 'index.html'));
		expect(resolveDistFile(root, '/index.html')).toBe(resolve(root, 'index.html'));
	});

	test('serves bundled files nested inside dist', function() {
		expect(resolveDistFile(root, '/main-abc.js')).toBe(resolve(root, 'main-abc.js'));
		expect(resolveDistFile(root, '/assets/icon-abc.svg')).toBe(resolve(root, 'assets/icon-abc.svg'));
	});

	test('rejects paths that leave dist', function() {
		expect(resolveDistFile(root, '/../package.json')).toBeNull();
		expect(resolveDistFile(root, '/%2e%2e/package.json')).toBeNull();
		expect(resolveDistFile(root, '/.%2e/package.json')).toBeNull();
		expect(resolveDistFile(root, '/..\\package.json')).toBeNull();
		expect(resolveDistFile(root, '/%')).toBeNull();
	});
});
