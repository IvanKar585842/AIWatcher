import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

/**
 * Resolve the key used for encrypting monitor session cookies.
 * Prefer MONITOR_SESSION_SECRET; fall back to CRON_SECRET so existing installs work.
 */
function resolveMasterKey(): Buffer {
  const raw =
    process.env.MONITOR_SESSION_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";
  if (!raw || raw.length < 16) {
    throw new Error(
      "MONITOR_SESSION_SECRET (or CRON_SECRET) must be set to store encrypted monitor sessions"
    );
  }
  return createHash("sha256").update(`watchflowing:monitor-session:${raw}`).digest();
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * `aad` binds ciphertext to a user (or monitor) so blobs cannot be swapped across accounts.
 */
export function encryptSecret(plaintext: string, aad: string): string {
  const key = resolveMasterKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptSecret(payload: string, aad: string): string {
  const key = resolveMasterKey();
  const buf = Buffer.from(payload, "base64url");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("Invalid encrypted payload");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function canEncryptSecrets(): boolean {
  const raw =
    process.env.MONITOR_SESSION_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";
  return raw.length >= 16;
}
