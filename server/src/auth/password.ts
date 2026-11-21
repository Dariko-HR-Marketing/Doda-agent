import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// OWASP tavsiya etgan scrypt parametrlaridan biri: N=2^14, r=8, p=5 (~16 MiB xotira)
const N = 16384;
const R = 8;
const P = 5;
const KEYLEN = 32;
const MAXMEM = 64 * 1024 * 1024;

// 2 GB VPS: bir vaqtda ko'pi bilan 2 ta xesh hisoblanadi
const MAX_CONCURRENT = 2;
let active = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
}
function release(): void {
  const next = waiters.shift();
  if (next) next();
  else active--;
}

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  await acquire();
  try {
    const salt = randomBytes(16);
    const key = await derive(password, salt);
    return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
  } finally {
    release();
  }
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[4]!, "base64");
  const expected = Buffer.from(parts[5]!, "base64");
  await acquire();
  try {
    const key = await derive(password, salt);
    return key.length === expected.length && timingSafeEqual(key, expected);
  } finally {
    release();
  }
}

/** Foydalanuvchi topilmaganda ham bir xil vaqt sarflash uchun (login'da vaqt orqali aniqlashga qarshi) */
let dummy: Promise<string> | undefined;
export async function burnPasswordTime(password: string): Promise<void> {
  dummy ??= hashPassword("doda-dummy-password");
  await verifyPassword(password, await dummy);
}
