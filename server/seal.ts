/**
 * A hold contains a live Schedulista session cookie and its CSRF token. The
 * browser has to hand that back to us on the final step, so it travels as an
 * opaque, authenticated, short-lived blob: encrypted so the client cannot read
 * the cookie, signed so it cannot forge one, and stamped so a stale one dies.
 *
 * This keeps the API stateless — no session store, no database — while still
 * never letting a Schedulista credential reach a browser in readable form.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** A hold is only good for as long as someone plausibly takes to fill a form in. */
export const HOLD_TTL_MS = 10 * 60 * 1000;

let warned = false;

function key(): Buffer {
  const secret = process.env.BOOKING_SECRET;
  if (secret && secret.length >= 32) return createHash('sha256').update(secret).digest();

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'BOOKING_SECRET is missing or too short. Set a 32+ character secret in the ' +
        'hosting environment before deploying. Booking cannot run without it.'
    );
  }
  if (!warned) {
    warned = true;
    console.warn('[booking] BOOKING_SECRET not set; using a development-only key.');
  }
  return createHash('sha256').update('perrins-development-only-key').digest();
}

export function seal(payload: object, now = Date.now()): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const json = JSON.stringify({ ...payload, exp: now + HOLD_TTL_MS });
  const body = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

export class SealExpired extends Error {}
export class SealInvalid extends Error {}

export function unseal<T>(token: string, now = Date.now()): T & { exp: number } {
  let parsed: (T & { exp: number }) | null = null;

  try {
    const raw = Buffer.from(token, 'base64url');
    if (raw.length <= IV_BYTES + TAG_BYTES) throw new Error('too short');

    const decipher = createDecipheriv(ALGORITHM, key(), raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const json = Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
    parsed = JSON.parse(json);
  } catch {
    throw new SealInvalid('This booking session is not valid.');
  }

  if (!parsed || typeof parsed.exp !== 'number') throw new SealInvalid('Malformed booking session.');
  if (parsed.exp < now) throw new SealExpired('This booking session has expired.');
  return parsed;
}
