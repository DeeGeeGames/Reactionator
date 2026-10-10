import {resolve} from 'node:path';
import {resolveDistFile} from './dist-path';

const distRoot = resolve(import.meta.dir, '..', 'dist');
const port = Number(Bun.env.PORT ?? '4173');
const hostname = Bun.env.HOST ?? '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid PORT: ${Bun.env.PORT ?? ''}`);

const server = Bun.serve({
	port,
	hostname,
	fetch: async function fetch(request): Promise<Response> {
		const filePath = resolveDistFile(distRoot, new URL(request.url).pathname);
		if (filePath === null) return new Response('Not found', {status: 404});
		const file = Bun.file(filePath);
		if (!(await file.exists())) return new Response('Not found', {status: 404});
		return new Response(file, {headers: {'Content-Type': file.type || 'application/octet-stream'}});
	},
});

console.log(`Serving dist at ${server.url}`);
