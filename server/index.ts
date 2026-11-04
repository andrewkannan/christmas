import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { ArcadeDatabase } from './db.ts';
import { createApiRouter } from './routes.ts';
import { getConfiguredTeamPin } from './auth.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath);
}
if (process.argv.includes('--production') && !process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

export function createApp(
  dbPath = process.env.DB_PATH || './data/christmas.db',
  options: { now?: () => number } = {}
) {
  const app = express();
  const db = new ArcadeDatabase(dbPath, options);

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '64kb' }));
  app.use('/api', createApiRouter(db));

  const distDir = path.resolve(__dirname, '../dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return { app, db };
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  const port = Number(process.env.PORT || 3001);
  const { app } = createApp();
  app.listen(port, () => {
    console.log(`🎄 Christmas Pocket Arcade server running on http://localhost:${port}`);
    if (process.env.NODE_ENV !== 'production' && !process.env.TEAM_PIN) {
      console.log(`🔐 Dev Team Dashboard PIN: ${getConfiguredTeamPin()} (set TEAM_PIN in .env for production)`);
    }
  });
}
