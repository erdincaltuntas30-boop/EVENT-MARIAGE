import "server-only"
import { decrypt, sign } from "@/lib/crypto"
import { serverEnv } from "@/lib/env"
import { supabaseAdmin } from "@/lib/supabase/admin"
import type { WebhookAction } from "@/lib/types"

export const DISPATCH_TIMEOUT_MS = 10_000

export type DispatchResult =
  | { ok: true; status: number }
  | { ok: false; reason: "not_configured" | "timeout" | "network" | "http"; status?: number }

export interface DispatchInput {
  orgId: string
  action: WebhookAction
  requestId: string
  triggeredBy: { id: string; email: string } | null
  payload: Record<string, unknown>
}

/**
 * Envoie une action utilisateur vers le webhook n8n configuré pour l'organisation.
 * Exécuté uniquement côté serveur : le navigateur ne connaît ni l'URL ni le secret.
 */
export async function dispatchToN8n({ orgId, action, requestId, triggeredBy, payload }: DispatchInput): Promise<DispatchResult> {
  const db = supabaseAdmin()
  const [{ data: hook }, { data: secretRow }] = await Promise.all([
    db.from("org_webhooks").select("url").eq("org_id", orgId).eq("action", action).maybeSingle(),
    db.from("org_secrets").select("outbound_secret_enc").eq("org_id", orgId).maybeSingle(),
  ])
  if (!hook?.url || !secretRow) return { ok: false, reason: "not_configured" }

  const secret = decrypt(secretRow.outbound_secret_enc, serverEnv().APP_ENCRYPTION_KEY)
  const body = JSON.stringify({
    request_id: requestId,
    action,
    org_id: orgId,
    triggered_by: triggeredBy,
    sent_at: new Date().toISOString(),
    ...payload,
  })
  const timestamp = Math.floor(Date.now() / 1000)

  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-em-timestamp": String(timestamp),
        "x-em-signature": sign(secret, timestamp, body),
        "x-em-action": action,
        "x-em-request-id": requestId,
      },
      body,
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
      cache: "no-store",
    })
    return res.ok ? { ok: true, status: res.status } : { ok: false, reason: "http", status: res.status }
  } catch (e) {
    return { ok: false, reason: e instanceof Error && e.name === "TimeoutError" ? "timeout" : "network" }
  }
}

/** Message lisible par une agence (pas de jargon technique). */
export function dispatchErrorMessage(r: Extract<DispatchResult, { ok: false }>): string {
  switch (r.reason) {
    case "not_configured":
      return "Aucune adresse n8n n'est configurée pour cette action (Réglages › Intégrations)."
    case "timeout":
      return "n8n n'a pas répondu à temps. Réessayez dans quelques instants."
    case "network":
      return "Impossible de joindre n8n. Vérifiez l'adresse configurée."
    case "http":
      return `n8n a refusé la demande (code ${r.status}).`
  }
}
