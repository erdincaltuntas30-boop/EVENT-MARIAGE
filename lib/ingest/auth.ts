import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { decrypt, verifySignature } from "@/lib/crypto"
import { serverEnv } from "@/lib/env"

export type AuthResult = { ok: true; orgId: string } | { ok: false; error: string }

/**
 * Authentifie un appel n8n : `Authorization: Bearer emk_…` identifie la clé (et donc l'organisation),
 * `X-EM-Timestamp` + `X-EM-Signature` prouvent la possession du secret et l'intégrité du corps.
 */
export async function authenticateIngest(db: SupabaseClient, headers: Headers, rawBody: string): Promise<AuthResult> {
  const keyId = headers.get("authorization")?.match(/^Bearer\s+(emk_[\w-]+)$/i)?.[1]
  if (!keyId) return { ok: false, error: "En-tête Authorization manquant ou invalide" }

  const { data: key } = await db
    .from("api_keys")
    .select("id, org_id, secret_enc, expires_at, revoked_at")
    .eq("key_id", keyId)
    .maybeSingle()

  if (!key || key.revoked_at || (key.expires_at && new Date(key.expires_at) <= new Date())) {
    return { ok: false, error: "Clé API inconnue, révoquée ou expirée" }
  }

  const secret = decrypt(key.secret_enc, serverEnv().APP_ENCRYPTION_KEY)
  const check = verifySignature(secret, headers.get("x-em-timestamp"), rawBody, headers.get("x-em-signature"))
  if (!check.ok) {
    const reasons = {
      missing: "Signature ou horodatage manquant",
      expired: "Horodatage hors de la fenêtre autorisée (±5 min)",
      mismatch: "Signature invalide",
    }
    return { ok: false, error: reasons[check.reason] }
  }

  void db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id).then()
  return { ok: true, orgId: key.org_id }
}
