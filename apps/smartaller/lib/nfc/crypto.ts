import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

/** Hash bcrypt del PIN (compatible con verifyNFCAndPin). */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

/**
 * Compara PIN contra hash bcrypt (preferido) o scrypt legado (scrypt$...).
 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;

  if (storedHash.startsWith("scrypt$")) {
    return verifyScryptLegacy(pin, storedHash);
  }

  try {
    return await bcrypt.compare(pin, storedHash);
  } catch {
    return false;
  }
}

function verifyScryptLegacy(pin: string, storedHash: string): boolean {
  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltHex = parts[4];
  const hashHex = parts[5];
  if (!Number.isFinite(n) || !saltHex || !hashHex) return false;

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(pin, salt, expected.length, { N: n, r, p });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function generateNfcToken(): string {
  return randomBytes(24).toString("base64url");
}
