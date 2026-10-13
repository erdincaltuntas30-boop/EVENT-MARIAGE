import { randomBytes } from "node:crypto"
import { describe, expect, it } from "vitest"
import { decrypt, encrypt, generateApiKey, sign, verifySignature } from "@/lib/crypto"

const key = randomBytes(32).toString("base64")

describe("chiffrement", () => {
  it("chiffre puis déchiffre", () => {
    const enc = encrypt("ems_secret", key)
    expect(enc).not.toContain("ems_secret")
    expect(decrypt(enc, key)).toBe("ems_secret")
  })

  it("refuse un contenu altéré", () => {
    const [iv, tag, data] = encrypt("ems_secret", key).split(".")
    const tampered = [iv, tag, Buffer.from("autre").toString("base64") + data].join(".")
    expect(() => decrypt(tampered, key)).toThrow()
  })
})

describe("signature HMAC", () => {
  const secret = generateApiKey().secret
  const body = JSON.stringify({ external_id: "x" })
  const now = 1_800_000_000

  it("accepte une signature valide", () => {
    expect(verifySignature(secret, String(now), body, sign(secret, now, body), now)).toEqual({ ok: true })
  })

  it("rejette un corps modifié", () => {
    const sig = sign(secret, now, body)
    expect(verifySignature(secret, String(now), body + " ", sig, now)).toEqual({ ok: false, reason: "mismatch" })
  })

  it("rejette un mauvais secret", () => {
    const sig = sign("autre", now, body)
    expect(verifySignature(secret, String(now), body, sig, now)).toEqual({ ok: false, reason: "mismatch" })
  })

  it("rejette un horodatage expiré (rejeu)", () => {
    const old = now - 301
    expect(verifySignature(secret, String(old), body, sign(secret, old, body), now)).toEqual({
      ok: false,
      reason: "expired",
    })
  })

  it("rejette les en-têtes manquants", () => {
    expect(verifySignature(secret, null, body, null, now)).toEqual({ ok: false, reason: "missing" })
  })
})
