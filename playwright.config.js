import { defineConfig, devices } from '@playwright/test';

// Deliberately not 4173. That is Vite's preview default, so a forgotten server
// from any sibling project answers on it, and `reuseExistingServer` below will
// quietly run the whole suite against that project's pages.
const PORT = Number(process.env.PORT ?? 4517);

export default defineConfig({
  testDir: './test',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/serve.js',
    env: { PORT: String(PORT) },
    // A file only this repository serves, rather than demo/index.html, which
    // every project of this shape has. A foreign server answers 404 here, so
    // Playwright starts ours instead of reusing it and the port clash fails
    // loudly, which is what the silent version cost an afternoon of debugging.
    url: `http://localhost:${PORT}/dist/split-reveal.css`,
    reuseExistingServer: !process.env.CI,
  },
});
