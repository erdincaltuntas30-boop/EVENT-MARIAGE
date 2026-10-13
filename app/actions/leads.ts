"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireOrg } from "@/lib/org"
import { supabaseServer } from "@/lib/supabase/server"
import type { Lead, LeadStage } from "@/lib/types"
import { demoReadOnly, fail, ok, type ActionResult } from "./result"
import { runAction } from "./run-action"

const stageSchema = z.enum(["new", "qualified", "meeting", "proposal", "won", "lost"])

async function loadLead(id: string) {
  const supabase = await supabaseServer()
  const { data } = await supabase.from("leads").select("*").eq("id", id).maybeSingle()
  return data as Lead | null
}

function leadPayload(lead: Lead) {
  return {
    lead: {
      id: lead.id,
      external_id: lead.external_id,
      first_name: lead.first_name,
      last_name: lead.last_name,
      partner_name: lead.partner_name,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      stage: lead.stage,
      wedding_date: lead.wedding_date,
      budget: lead.budget_cents == null ? null : lead.budget_cents / 100,
      guest_count: lead.guest_count,
    },
  }
}

const fullName = (l: Lead) => [l.first_name, l.last_name].filter(Boolean).join(" ")

export async function followUpLead(leadId: string): Promise<ActionResult> {
  const blocked = demoReadOnly()
  if (blocked) return blocked
  const ctx = await requireOrg()
  const lead = await loadLead(leadId)
  if (!lead) return fail("notFound")
  const res = await runAction({
    ctx,
    action: "lead.follow_up",
    title: `Relance demandée pour ${fullName(lead)}`,
    leadId,
    payload: leadPayload(lead),
  })
  revalidatePath(`/leads/${leadId}`)
  return res.ok ? ok("followUpSent") : fail("dispatchFailed", res.message)
}

export async function sendProposal(leadId: string): Promise<ActionResult> {
  const blocked = demoReadOnly()
  if (blocked) return blocked
  const ctx = await requireOrg()
  const lead = await loadLead(leadId)
  if (!lead) return fail("notFound")
  const res = await runAction({
    ctx,
    action: "lead.send_proposal",
    title: `Envoi de la proposition à ${fullName(lead)}`,
    leadId,
    payload: leadPayload(lead),
  })
  if (res.ok && lead.stage !== "proposal" && lead.stage !== "won") {
    const supabase = await supabaseServer()
    await supabase.from("leads").update({ stage: "proposal" }).eq("id", leadId)
  }
  revalidatePath(`/leads/${leadId}`)
  return res.ok ? ok("proposalSent") : fail("dispatchFailed", res.message)
}

export async function moveLeadStage(leadId: string, stage: LeadStage, lostReason?: string): Promise<ActionResult> {
  const blocked = demoReadOnly()
  if (blocked) return blocked
  const ctx = await requireOrg()
  const parsed = stageSchema.safeParse(stage)
  if (!parsed.success) return fail("invalid")
  const lead = await loadLead(leadId)
  if (!lead) return fail("notFound")
  if (lead.stage === stage) return ok("unchanged")

  const supabase = await supabaseServer()
  const { error } = await supabase
    .from("leads")
    .update({ stage, lost_reason: stage === "lost" ? (lostReason ?? null) : null })
    .eq("id", leadId)
  if (error) return fail("unknown", error.message)

  await runAction({
    ctx,
    action: "lead.stage_changed",
    title: `${fullName(lead)} déplacé vers une nouvelle étape`,
    leadId,
    payload: { ...leadPayload({ ...lead, stage }), from: lead.stage, to: stage },
    optional: true,
  })
  revalidatePath("/leads")
  return ok("stageUpdated")
}

const notesSchema = z.object({ notes: z.string().max(5000) })

export async function updateLeadNotes(leadId: string, notes: string): Promise<ActionResult> {
  const blocked = demoReadOnly()
  if (blocked) return blocked
  await requireOrg()
  const parsed = notesSchema.safeParse({ notes })
  if (!parsed.success) return fail("invalid")
  const supabase = await supabaseServer()
  const { error } = await supabase.from("leads").update({ notes: parsed.data.notes }).eq("id", leadId)
  if (error) return fail("unknown", error.message)
  revalidatePath(`/leads/${leadId}`)
  return ok("saved")
}
