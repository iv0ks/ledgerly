// Seeds the lab's data. Idempotent: it wipes the two tables and re-inserts a
// fixed, deterministic dataset so the challenge is identical on every boot.
//
// The cast of characters IS the scenario:
//   - alice  — YOU. A low-privilege user with a couple of her own invoices.
//   - bob    — the victim. One of his invoices carries the flag in its note.
//   - carol  — a third user, so bob's invoice isn't trivially "the other one".
//
// Sequential ids make the IDOR discoverable: alice's invoices are low ids, and
// she can walk the id space to reach bob's.
import { db, sql } from './client.js';
import { users, invoices } from './schema.js';
import { hashPassword } from '../auth.js';
import { config } from '../config.js';

async function main(): Promise<void> {
  console.log('[seed] resetting tables …');
  // TRUNCATE ... RESTART IDENTITY so ids are stable across reseeds.
  await sql`TRUNCATE TABLE invoices RESTART IDENTITY CASCADE`;
  await sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`;

  // --- Users -------------------------------------------------------------
  const [alice, bob, carol] = await db
    .insert(users)
    .values([
      {
        username: 'alice',
        displayName: 'Alice Martins',
        passwordHash: hashPassword('password123'),
      },
      { username: 'bob', displayName: 'Bob Carrasco', passwordHash: hashPassword('hunter2') },
      { username: 'carol', displayName: 'Carol Nguyen', passwordHash: hashPassword('letmein1') },
    ])
    .returning();

  // --- Invoices ----------------------------------------------------------
  // alice (you): two ordinary invoices — these are what the dashboard lists.
  // bob (victim): two invoices; the SECOND one holds the flag in its note.
  // carol: one invoice, as realistic noise.
  await db.insert(invoices).values([
    {
      ownerId: alice!.id,
      number: 'INV-1001',
      client: 'Northwind Studios',
      amount: '1240.00',
      status: 'paid',
      notes: 'Thanks for the quick turnaround.',
    },
    {
      ownerId: alice!.id,
      number: 'INV-1002',
      client: 'Harbor & Co.',
      amount: '860.50',
      status: 'sent',
      notes: 'Net 30.',
    },
    {
      ownerId: bob!.id,
      number: 'INV-2006',
      client: 'Atlas Freight',
      amount: '3115.75',
      status: 'paid',
      notes: 'Quarterly logistics retainer.',
    },
    {
      ownerId: bob!.id,
      number: 'INV-2007',
      client: 'Vertex Capital',
      amount: '18790.00',
      status: 'sent',
      // The flag lives here — on the VICTIM's invoice, reachable only by
      // breaking access control on GET /api/invoices/:id.
      notes: `Confidential settlement memo — do not share. ${config.flag}`,
    },
    {
      ownerId: carol!.id,
      number: 'INV-3010',
      client: 'Lumen Design',
      amount: '540.00',
      status: 'draft',
      notes: 'Awaiting approval.',
    },
  ]);

  console.log('[seed] done. users: alice, bob, carol. flag seeded on bob INV-2007.');
  await sql.end();
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
