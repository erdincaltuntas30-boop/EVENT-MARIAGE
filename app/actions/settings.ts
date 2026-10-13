"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { encrypt, generateApiKey, generateSecret } from "@/lib/crypto"
import { publicEnv, serverEnv } from "@/lib/env"
import { requireAdmin } from "@/lib/org"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { supabaseServer } from "@/lib/supabase/server"
import { WEBHOOK_ACTIONS, type WebhookAction } from "@/lib/types"
import { demoReadOnly, fail, ok, type ActionResult } from "./result"

const ROTATION_GRACE_HOURS = 24

// ───────────── Agence ─────────────

const agencySchema = z.object({
  name: z.string().trim().min(2).max(80),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logo_url: z.url().nullish().or(z.literal("")),
  locale: z.enum(["fr", "en", "nl"]),
})

export async function updateAgency(input: z.input<typeof agencySchema>): Promise<ActionResult> {
  const blocked = demoReadOnly()
  if (blocked) return blocked
  const ctx = await requireAdmin()
  const parsed = agencySchema.safeParse(input)
  if (!parsed.success) return fail("invalid")
  const supabase = await supabaseServer()
  const { error } = await supabase
    .from("organizations")
    .update({ ...parsed.data, logo_url: parsed.data.logo_url || null })
    .eq("id", ctx.org.id)
  if (error) return fail("unknown", error.message)
  revalidatePath("/", "layout")
  return ok("saved")
}

// ───────────── Équipe ─────────────

const inviteSchema = z.object({ email: z.email(), role: z.enum(["admin", "planner"]) })

export async function inviteMember(input: z.input<typeof inviteSchema>): Promise<ActionResult> {
  const blocked = demoReadOnly()
  if (blocked) return blocked
  const ctx = await requireAdmin()
  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) return fail("invalid")
  const admin = supabaseAdmin()

  // Utilisateur existant ? Sinon, invitation par email (Supabase Auth).
  let userId: string | undefined
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  userId = list?.users.find((u) => u.email?.toLowerCase() === parsed.data.email.toLowerCase())?.id
  if (!userId) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback`,
    })
    if (error) return fail("unknown", error.message)
    userId = data.user.id
  }

  const { error } = await admin
    .from("memberships")
    .upsert({ org_id: ctx.org.id, user_id: userId, role: parsed.data.role }, { onConflict: "org_id,user_id" })
  if (error) return fail("unknown", error.message)
  revalidatePath("/reglages/equipe")
  return ok("memberInvited")
}

export async function updateMemberRole(userId: string, role: "admin" | "planner"): Promise<ActionResult> {
  const blocked = demoReadOnly()
  if (blocked) return blocked
  const ctx = await requireAdmin()
  if (userId === ctx.userId) return fail("cannotChangeSelf")
  const supabase = await supabaseServer()
  const { error } = await supabase.from("memberships").update({ role }).eq("org_id", ctx.org.id).eq("user_id", userId)
  if (error) return fail("unknown", error.message)
  revalidatePath("/reglages/equipe")
  return ok("saved")
}

export async function removeMember(userId: string): Promise<ActionResult> {
  const blocked = demoReadOnly()
  if (blocked) return blocked
  const ctx = await requireAdmin()
  if (userId === ctx.userId) return fail("cannotChangeSelf")
  const supabase = await supabaseServer()
  const { error } = await supabase.from("memberships").delete().eq("org_id", ctx.org.id).eq("user_id", userId)
  if (error) return fail("unknown", error.message)
  revalidatePath("/reglages/equipe")
  return ok("memberRemoved")
}

// ───────────── Webhooks n8n ─────────────

const webhooksSchema = z.record(z.enum(WEBHOOK_ACTIONS), z.url().or(z.literal("")))

export async function saveWebhooks(input: Partial<Record<WebhookAction, string>>): Promise<ActionResult> {
  const blocked = demoReadOnly()
  if (blocked) return blocked
  const ctx = await requireAdmin()
  const parsed = webhooksSchema.safeParse(input)
  if (!parsed.success) return fail("invalidUrl")
  const supabase = await supabaseServer()
  const entries = Object.entries(parsed.data) as [WebhookAction, string][]
  const toDelete = entries.filter(([, url]) => !url).map(([a]) => a)
  const toUpsert = entries.filter(([, url]) => url).map(([action, url]) => ({ org_id: ctx.org.id, action, url }))

  if (toUpsert.length) {
    const { error } = await supabase.from("org_webhooks").upsert(toUpsert, { onConflict: "org_id,action" })
    if (error) return fail("unknown", error.message)
  }
  if (toDelete.length) {
    await supabase.from("org_webhooks").delete().eq("org_id", ctx.org.id).in("action", toDelete)
  }
  revalidatePath("/reglages/integrations")
  return ok("saved")
}

export async function testWebhook(action: WebhookAction): Promise<ActionResult> {
  const blocked = demoReadOnly()
  if (blocked) return blocked
  const ctx = await requireAdmin()
  const { dispatchToN8n, dispatchErrorMessage } = await import("@/lib/n8n/dispatch")
  const res = await dispatchToN8n({
    orgId: ctx.org.id,
    action,
    requestId: `test-${Date.now()}`,
    triggeredBy: { id: ctx.userId, email: ctx.email },
    payload: { test: true },
  })
  return res.ok ? ok("webhookOk") : fail("dispatchFailed", dispatchErrorMessage(res))
}

/** Nouveau secret de signature sortant : affiché une seule fois. */
export async function rotateOutboundSecret(): Promise<ActionResult> {
  const blocked = demoReadOnly()
  if (blocked) return blocked
  const ctx = await requireAdmin()
  const secret = generateSecret()
  const { error } = await supabaseAdmin()
    .from("org_secrets")
    .upsert({ org_id: ctx.org.id, outbound_secret_enc: encrypt(secret, serverEnv().APP_ENCRYPTION_KEY) })
  if (error) return fail("unknown", error.message)
  return ok("secretRotated", { secret })
}

// ───────────── Clés API d'ingestion ─────────────

/**
 * Crée une clé. Avec `rotate`, les clés actives existantes expirent dans 24 h
 * pour laisser le temps de mettre n8n à jour sans interruption.
 */
export async function createApiKey(label: string, rotate: boolean): Promise<ActionResult> {
  const blocked = demoReadOnly()
  if (blocked) return blocked
  const ctx = await requireAdmin()
  const admin = supabaseAdmin()
  const { keyId, secret, last4 } = generateApiKey()

  if (rotate) {
    const expiresAt = new Date(Date.now() + ROTATION_GRACE_HOURS * 3600_000).toISOString()
    await admin
      .from("api_keys")
      .update({ expires_at: expiresAt })
      .eq("org_id", ctx.org.id)
      .is("revoked_at", null)
      .or(`expires_at.is.null,expires_at.gt.${expiresAt}`)
  }

  const { error } = await admin.from("api_keys").insert({
    org_id: ctx.org.id,
    key_id: keyId,
    secret_enc: encrypt(secret, serverEnv().APP_ENCRYPTION_KEY),
    last4,
    label: z.string().trim().min(1).max(60).catch("n8n").parse(label),
    created_by: ctx.userId,
  })
  if (error) return fail("unknown", error.message)
  revalidatePath("/reglages/integrations")
  return ok("keyCreated", { keyId, secret })
}

export async function revokeApiKey(id: string): Promise<ActionResult> {
  const blocked = demoReadOnly()
  if (blocked) return blocked
  const ctx = await requireAdmin()
  const { error } = await supabaseAdmin()
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", ctx.org.id)
  if (error) return fail("unknown", error.message)
  revalidatePath("/reglages/integrations")
  return ok("keyRevoked")
}
