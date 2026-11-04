import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = 4310;
// Fresh throwaway database per run so tests never depend on (or pollute) real outreach data.
const E2E_DB_PATH = path.join(os.tmpdir(), `xmas-arcade-e2e-${Date.now()}.db`);

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  // Android phones common at Malaysian outreach sites: a modern flagship and a small 360px screen.
  projects: [
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'galaxy-s8', use: { ...devices['Galaxy S8'] } },
  ],
  webServer: {
    command: 'node ./node_modules/tsx/dist/cli.mjs server/index.ts --production',
    url: `http://localhost:${PORT}/api/public/config`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: String(PORT),
      DB_PATH: E2E_DB_PATH,
      TEAM_PIN: '2468',
      SESSION_SECRET: 'e2e-only-session-secret-not-for-production',
    },
  },
});
