// Express application factory.
//
// Kept as a factory (createApp) so tests can boot an isolated instance.
import express, { type Express } from 'express';
import session from 'express-session';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from './config.js';
import { router } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');

export function createApp(): Express {
  const app = express();

  // Behind Traefik the app sees a proxy; trust it so secure cookies work.
  app.set('trust proxy', 1);

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use(
    session({
      name: 'ledgerly.sid',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        // Secure cookies require HTTPS; the lab runs over plain HTTP on
        // localhost too, so this stays off. Traefik terminates TLS upstream.
        secure: false,
        maxAge: 1000 * 60 * 60, // 1 hour
      },
    }),
  );

  // API + health routes.
  app.use(router);

  // Static UI assets (css, js, favicon) and the single-page dashboard.
  app.use(express.static(PUBLIC_DIR));
  app.get('/', (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  // JSON 404 for unknown API routes; HTML handled by static otherwise.
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  return app;
}
