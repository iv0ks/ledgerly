// Database schema (Drizzle ORM).
//
// Two tables model the whole lab:
//  - `users`    — the seeded identities (alice = you, bob = the victim).
//  - `invoices` — each row belongs to exactly one user via `ownerId`.
//
// The IDs are plain sequential integers on purpose: in a level-1 IDOR the
// *predictability* of the identifier is part of the lesson. Later labs in the
// series move to harder-to-guess identifiers.
import { pgTable, serial, integer, text, timestamp, numeric } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  // The login handle (e.g. "alice"). Unique in practice; kept simple for the lab.
  username: text('username').notNull(),
  // Display name shown in the UI.
  displayName: text('display_name').notNull(),
  // Bcrypt-style hashes would be used in production; this lab stores a salted
  // SHA-256 hash (see src/auth.ts) — enough to make the login realistic without
  // pulling in native crypto deps. NEVER do this in a real app.
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  // Owner of the invoice. THIS is the field the vulnerable endpoint forgets to
  // check against the session user.
  ownerId: integer('owner_id')
    .notNull()
    .references(() => users.id),
  // Human-facing invoice number, e.g. "INV-2007".
  number: text('number').notNull(),
  // Who the invoice was issued to (a client of the ledgerly user).
  client: text('client').notNull(),
  // Monetary amount as a fixed-precision string (numeric avoids float drift).
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('EUR'),
  status: text('status').notNull().default('draft'),
  issuedAt: timestamp('issued_at').notNull().defaultNow(),
  // Free-text internal memo. The challenge flag is seeded into the victim's
  // (bob's) invoice note, so reading someone else's invoice captures it.
  notes: text('notes').notNull().default(''),
});

export type User = typeof users.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
