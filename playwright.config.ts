import {defineConfig} from '@playwright/test';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
export default defineConfig({
	testDir: './tests/browser',
	outputDir: './test-output/browser',
	timeout: 150_000,
	expect: {timeout: 5_000},
	fullyParallel: true,
	workers: 3,
	use: {
		baseURL: 'http://127.0.0.1:4173',
		viewport: {width: 1280, height: 800},
		trace: 'retain-on-failure',
		launchOptions: executablePath === undefined ? {} : {executablePath},
	},
	webServer: {
		command: 'bun run build && PORT=4173 HOST=127.0.0.1 bun run preview',
		url: 'http://127.0.0.1:4173',
		reuseExistingServer: !process.env.CI,
	},
});
