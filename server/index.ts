import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { ArcadeDatabase } from './db.ts';
import { createApiRouter } from './routes.ts';
import { getConfiguredTeamPin } from './auth.ts';
import { connectPostgresFromEnv, resolvePostgresConnectionUrl } from './postgres.ts';

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
  app.use('/api', createApiRouter(db, options));

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

export async function initDatabasePersistence(
  db: ArcadeDatabase,
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  const pgUrl = resolvePostgresConnectionUrl(env);
  if (!pgUrl) {
    if (env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID || env.NODE_ENV === 'production') {
      console.warn(
        '⚠️  No DATABASE_URL detected — falling back to container-local SQLite. Link DATABASE_URL=${{Postgres.DATABASE_URL}} on your Railway Web service so deploys never reset your database.'
      );
    }
    return;
  }

  try {
    const adapter = await connectPostgresFromEnv(env);
    if (adapter) {
      const counts = await db.attachRemoteAdapter(adapter);
      console.log(
        `🐘 PostgreSQL persistence active (${counts.hydratedLeads} contacts, ${counts.hydratedEvents} events, ${counts.hydratedRuns} runs hydrated).`
      );
    }
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : 'Connection failed';
    const safeMsg = rawMsg.replace(/\/\/([^:/@]+):([^@]+)@/g, '//$1:***@');
    console.error('❌ PostgreSQL startup connection failed:', safeMsg);
    db.setStartupWarning(
      'DATABASE_URL was detected, but connecting to PostgreSQL failed on startup. Verify your Railway Postgres service is running and DATABASE_URL=${{Postgres.DATABASE_URL}} is up to date.'
    );
  }
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  const port = Number(process.env.PORT || 3001);
  const { app, db } = createApp();

  void initDatabasePersistence(db).finally(() => {
    const server = app.listen(port, () => {
      console.log(`🎄 Christmas Pocket Arcade server running on http://localhost:${port}`);
      if (process.env.NODE_ENV !== 'production' && !process.env.TEAM_PIN) {
        console.log(
          `🔐 Dev Team Dashboard PIN: ${getConfiguredTeamPin()} (set TEAM_PIN in .env for production)`
        );
      }
    });

    let shuttingDown = false;
    const shutdown = (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`🛑 Received ${signal}, flushing database writes before exit...`);
      server.close(() => {
        void db.closeAsync().finally(() => process.exit(0));
      });
      setTimeout(() => {
        void db.closeAsync().finally(() => process.exit(0));
      }, 5000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  });
}
