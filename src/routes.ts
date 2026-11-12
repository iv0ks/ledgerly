// HTTP routes.
//
// The intentional vulnerability lives in `GET /api/invoices/:id`: it looks up
// an invoice by its primary key and returns it WITHOUT checking that the
// invoice belongs to the logged-in user. That missing ownership check is the
// whole lab (IDOR / broken access control, CWE-639).
import { Router, type Request, type Response, type NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from './db/client.js';
import { users, invoices } from './db/schema.js';
import { verifyPassword } from './auth.js';

export const router = Router();

// ---------------------------------------------------------------------------
// Auth guard: most of the app requires a logged-in session.
// ---------------------------------------------------------------------------
function requireLogin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Not authenticated. POST /api/login first.' });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Health check (used by the Docker HEALTHCHECK). Returns the literal "ok".
// ---------------------------------------------------------------------------
router.get('/healthz', (_req, res) => {
  res.type('text/plain').send('ok');
});

// ---------------------------------------------------------------------------
// Session: log in / log out.
// ---------------------------------------------------------------------------
router.post('/api/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({
    ok: true,
    user: { id: user.id, username: user.username, displayName: user.displayName },
  });
});

router.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// Who am I? Convenience endpoint for the UI.
router.get('/api/me', requireLogin, async (req, res) => {
  const [user] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, req.session.userId!))
    .limit(1);
  res.json({ user });
});

// ---------------------------------------------------------------------------
// Invoice listing — the SAFE endpoint.
//
// This one scopes the query to the session user (`ownerId = me`), so the
// dashboard only ever shows your own invoices. A legitimate user never sees
// anyone else's invoice number through this route — which is exactly what makes
// the IDOR below non-obvious: you have to *guess* another id.
// ---------------------------------------------------------------------------
router.get('/api/invoices', requireLogin, async (req, res) => {
  const me = req.session.userId!;
  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      client: invoices.client,
      amount: invoices.amount,
      currency: invoices.currency,
      status: invoices.status,
      issuedAt: invoices.issuedAt,
    })
    .from(invoices)
    .where(eq(invoices.ownerId, me));
  res.json({ invoices: rows });
});

// ---------------------------------------------------------------------------
// Invoice detail — the VULNERABLE endpoint (IDOR / CWE-639).
//
// It requires you to be logged in, then fetches the invoice by its id and
// returns it. What it never does is verify that `invoice.ownerId` matches the
// session user. Any authenticated user can read ANY invoice by changing the id
// in the URL — including the victim's invoice that carries the flag in `notes`.
//
// The fix (see SOLUTION.md) is a single added condition:
//   if (invoice.ownerId !== req.session.userId) return 404;
// ---------------------------------------------------------------------------
router.get('/api/invoices/:id', requireLogin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'invalid invoice id' });
    return;
  }

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);

  if (!invoice) {
    res.status(404).json({ error: 'invoice not found' });
    return;
  }

  // ⚠️ MISSING OWNERSHIP CHECK — this is the intentional vulnerability.
  // A correct implementation would reject invoices that are not owned by the
  // authenticated user before returning them.

  res.json({ invoice });
});
