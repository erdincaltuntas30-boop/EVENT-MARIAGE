"use server"

import { revalidatePath } from "next/cache"
import { requireOrg } from "@/lib/org"
import { supabaseServer } from "@/lib/supabase/server"
import { fail, ok, type ActionResult } from "./result"

export async function toggleTask(taskId: string, done: boolean): Promise<ActionResult> {
  const ctx = await requireOrg()
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from("event_tasks")
    .update({ done_at: done ? new Date().toISOString() : null, done_by: done ? ctx.userId : null })
    .eq("id", taskId)
    .select("event_id")
    .single()
  if (error) return fail("unknown", error.message)
  revalidatePath(`/evenements/${data.event_id}`)
  return ok("saved")
}

export async function markPaymentReceived(paymentId: string): Promise<ActionResult> {
  const ctx = await requireOrg()
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from("payments")
    .update({ status: "received", received_at: new Date().toISOString() })
    .eq("id", paymentId)
    .select("event_id, label, amount_cents")
    .single()
  if (error) return fail("unknown", error.message)
  await supabase.from("automation_events").insert({
    org_id: ctx.org.id,
    type: "payment.received",
    status: "success",
    actor: "user",
    actor_user_id: ctx.userId,
    event_id: data.event_id,
    title: `${data.label} marqué comme reçu`,
    detail: { amount_cents: data.amount_cents },
  })
  revalidatePath(`/evenements/${data.event_id}`)
  return ok("paymentReceived")
}
