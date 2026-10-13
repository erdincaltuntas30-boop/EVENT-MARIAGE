import "server-only"
import { randomUUID } from "node:crypto"
import { dispatchErrorMessage, dispatchToN8n } from "@/lib/n8n/dispatch"
import type { OrgContext } from "@/lib/org"
import { supabaseServer } from "@/lib/supabase/server"
import type { WebhookAction } from "@/lib/types"

interface RunActionInput {
  ctx: OrgContext
  action: WebhookAction
  title: string
  automationId?: string | null
  leadId?: string | null
  eventId?: string | null
  payload: Record<string, unknown>
  /** Si vrai, une absence de webhook n'est pas une erreur (ex. changement d'étape). */
  optional?: boolean
}

/**
 * Action utilisateur → n8n, tracée dans automation_events :
 * 1. ligne « en cours » (actor = user), 2. webhook signé, 3. erreur lisible si l'envoi échoue.
 * n8n renvoie ensuite `request_id` dans /api/ingest/automation-run pour clore la ligne.
 */
export async function runAction(input: RunActionInput) {
  const supabase = await supabaseServer()
  const requestId = randomUUID()

  const { data: row, error } = await supabase
    .from("automation_events")
    .insert({
      org_id: input.ctx.org.id,
      external_id: requestId,
      automation_id: input.automationId ?? null,
      type: input.action,
      status: "pending",
      actor: "user",
      actor_user_id: input.ctx.userId,
      lead_id: input.leadId ?? null,
      event_id: input.eventId ?? null,
      title: input.title,
      detail: { requested_by: input.ctx.fullName },
    })
    .select("id")
    .single()
  if (error) throw error

  const result = await dispatchToN8n({
    orgId: input.ctx.org.id,
    action: input.action,
    requestId,
    triggeredBy: { id: input.ctx.userId, email: input.ctx.email },
    payload: input.payload,
  })

  if (!result.ok) {
    if (input.optional && result.reason === "not_configured") {
      await supabase.from("automation_events").update({ status: "info" }).eq("id", row.id)
      return { ok: true as const, requestId }
    }
    const message = dispatchErrorMessage(result)
    await supabase.from("automation_events").update({ status: "error", error_message: message }).eq("id", row.id)
    return { ok: false as const, requestId, message, reason: result.reason }
  }
  return { ok: true as const, requestId }
}
