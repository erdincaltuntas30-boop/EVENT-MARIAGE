"use server"

import { revalidatePath } from "next/cache"
import { requireOrg } from "@/lib/org"
import { supabaseServer } from "@/lib/supabase/server"
import type { ActivityEvent, Automation } from "@/lib/types"
import { demoReadOnly, fail, ok, type ActionResult } from "./result"
import { runAction } from "./run-action"

export async function toggleAutomation(automationId: string, enabled: boolean): Promise<ActionResult> {
  const blocked = demoReadOnly()
  if (blocked) return blocked
  const ctx = await requireOrg()
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from("automations")
    .update({ is_enabled: enabled })
    .eq("id", automationId)
    .select("*")
    .single()
  if (error || !data) return fail("notFound")
  const automation = data as Automation

  // La pause est effective immédiatement dans l'app (n8n peut la vérifier via /api/v1/automations/:key) ;
  // le webhook permet en plus à n8n de désactiver le workflow correspondant.
  const res = await runAction({
    ctx,
    action: "automation.toggle",
    title: `${automation.name} ${enabled ? "réactivée" : "mise en pause"}`,
    automationId,
    payload: { automation_key: automation.key, enabled },
    optional: true,
  })
  revalidatePath("/automatisations")
  if (!res.ok) return fail("toggleSyncFailed", res.message)
  return ok(enabled ? "automationEnabled" : "automationPaused")
}

export async function retryActivity(activityId: string): Promise<ActionResult> {
  const blocked = demoReadOnly()
  if (blocked) return blocked
  const ctx = await requireOrg()
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("automation_events")
    .select("*, automations(key, name)")
    .eq("id", activityId)
    .maybeSingle()
  if (!data) return fail("notFound")
  const failed = data as ActivityEvent & { automations: Pick<Automation, "key" | "name"> | null }
  if (failed.status !== "error") return fail("notRetryable")

  const res = await runAction({
    ctx,
    action: "automation.retry",
    title: `Nouvelle tentative : ${failed.title}`,
    automationId: failed.automation_id,
    leadId: failed.lead_id,
    eventId: failed.event_id,
    payload: {
      automation_key: failed.automations?.key ?? null,
      retry_of: { id: failed.id, external_id: failed.external_id, detail: failed.detail },
    },
  })
  if (res.ok) {
    await supabase
      .from("automation_events")
      .update({ detail: { ...failed.detail, retried_by: res.requestId } })
      .eq("id", activityId)
  }
  revalidatePath("/automatisations")
  return res.ok ? ok("retrySent") : fail("dispatchFailed", res.message)
}
