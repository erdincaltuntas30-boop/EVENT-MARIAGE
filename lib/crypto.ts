import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto"

export const SIGNATURE_TOLERANCE_SECONDS = 300

function keyFrom(base64Key: string) {
  const key = Buffer.from(base64Key, "base64")
  if (key.length !== 32) throw new Error("APP_ENCRYPTION_KEY doit faire 32 octets (base64)")
  return key
}

/** AES-256-GCM. Format : base64(iv).base64(tag).base64(ciphertext) */
export function encrypt(plain: string, base64Key: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", keyFrom(base64Key), iv)
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".")
}

export function decrypt(payload: string, base64Key: string): string {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64"))
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(base64Key), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")
}

/** Signature transmise dans `X-EM-Signature` : sha256=hex(HMAC(secret, `${timestamp}.${rawBody}`)) */
export function sign(secret: string, timestamp: string | number, rawBody: string): string {
  return "sha256=" + createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")
}

export type SignatureCheck = { ok: true } | { ok: false; reason: "missing" | "expired" | "mismatch" }

export function verifySignature(
  secret: string,
  timestamp: string | null,
  rawBody: string,
  signature: string | null,
  nowSeconds = Math.floor(Date.now() / 1000),
): SignatureCheck {
  if (!timestamp || !signature) return { ok: false, reason: "missing" }
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: "expired" }
  }
  const expected = Buffer.from(sign(secret, timestamp, rawBody))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return { ok: false, reason: "mismatch" }
  }
  return { ok: true }
}

/** Nouvelle clé d'ingestion : identifiant public + secret de signature (affiché une seule fois). */
export function generateApiKey() {
  const keyId = "emk_" + randomBytes(9).toString("base64url")
  const secret = "ems_" + randomBytes(32).toString("base64url")
  return { keyId, secret, last4: secret.slice(-4) }
}

export function generateSecret() {
  return "emw_" + randomBytes(32).toString("base64url")
}
