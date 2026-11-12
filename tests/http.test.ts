// Integration smoke tests that do not require a live database.
//
// The full IDOR exploit is verified end-to-end against the Docker stack (see
// SOLUTION.md). These tests pin the two guarantees that do not touch Postgres:
//   1. the health endpoint responds, and
//   2. the invoice endpoints refuse unauthenticated callers (the auth guard
//      runs before any DB access, so no connection is opened).
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('ledgerly http surface', () => {
  it('serves the health check', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.text).toBe('ok');
  });

  it('requires a session to list invoices', async () => {
    const res = await request(app).get('/api/invoices');
    expect(res.status).toBe(401);
  });

  it('requires a session to read a single invoice (the IDOR endpoint)', async () => {
    const res = await request(app).get('/api/invoices/4');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid invoice id shape only after auth', async () => {
    // Still 401 (not 400) because the auth guard runs first — proving the
    // ownership flaw is reachable only by authenticated users.
    const res = await request(app).get('/api/invoices/not-a-number');
    expect(res.status).toBe(401);
  });
});
