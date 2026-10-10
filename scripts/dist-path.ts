import {resolve, sep} from 'node:path';

// Maps a request path onto one file inside distRoot. The preview server uses
// this to reject encoded paths that would leave the output directory.
export const resolveDistFile = function(distRoot: string, pathname: string): string | null {
	let decoded: string;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return null;
	}
	if (decoded.includes('\\') || decoded.includes('\0')) return null;
	const segments = decoded.split('/').filter(function(segment) { return segment.length > 0; });
	if (segments.some(function(segment) { return segment === '.' || segment === '..'; })) return null;
	const [only] = segments;
	const filePath = segments.length === 0 || (segments.length === 1 && only === 'index.html')
		? resolve(distRoot, 'index.html')
		: resolve(distRoot, ...segments);
	const rootWithSep = distRoot.endsWith(sep) ? distRoot : `${distRoot}${sep}`;
	if (!filePath.startsWith(rootWithSep)) return null;
	return filePath;
};
