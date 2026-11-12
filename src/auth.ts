// Minimal authentication helpers.
//
// This lab needs *identities* so that "accessing someone else's resource" is a
// meaningful thing to do. It is NOT a lesson in password storage, so we keep it
// deliberately small: a salted SHA-256 using Node's built-in crypto, no native
// bcrypt dependency. Do NOT copy this into a real application — use argon2id or
// bcrypt there.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function hashPassword(password: string, salt?: string): string {
  const useSalt = salt ?? randomBytes(16).toString('hex');
  const digest = createHash('sha256').update(`${useSalt}:${password}`).digest('hex');
  return `${useSalt}:${digest}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt] = stored.split(':');
  if (!salt) return false;
  const candidate = hashPassword(password, salt);
  const a = Buffer.from(candidate);
  const b = Buffer.from(stored);
  // Constant-time compare to avoid leaking match progress via timing.
  return a.length === b.length && timingSafeEqual(a, b);
}

// Augment express-session with our typed user field.
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    username?: string;
  }
}
