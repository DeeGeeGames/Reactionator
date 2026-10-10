import {defineConfig} from 'vite';

// Project Pages are served from /<repo>/. Local dev, tests, and Playwright keep /.
const pagesBase = function(): string {
	const configured = process.env.BASE_PATH;
	if (configured === undefined || configured === '' || configured === '/') return '/';
	const withLeadingSlash = configured.startsWith('/') ? configured : `/${configured}`;
	return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
};

export default defineConfig({
	base: pagesBase(),
});
