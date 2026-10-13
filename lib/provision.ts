import type { SupabaseClient } from "@supabase/supabase-js"
import { DEFAULT_AUTOMATIONS } from "@/lib/automations/catalog"
import { encrypt, generateSecret } from "@/lib/crypto"

export function slugify(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "agence"
  )
}

/**
 * Crée une organisation complète : membre admin, catalogue d'automatisations, secret sortant.
 * Utilisé par l'onboarding et par le script de démo (client service role requis).
 */
export async function provisionOrganization(
  db: SupabaseClient,
  opts: { name: string; ownerId: string; encryptionKey: string; slug?: string; accentColor?: string },
) {
  const slug = opts.slug ?? `${slugify(opts.name)}-${Math.random().toString(36).slice(2, 6)}`
  const { data: org, error } = await db
    .from("organizations")
    .insert({ name: opts.name, slug, accent_color: opts.accentColor ?? "#4F6B5A" })
    .select("*")
    .single()
  if (error) throw error

  const steps = await Promise.all([
    db.from("memberships").insert({ org_id: org.id, user_id: opts.ownerId, role: "admin" }),
    db.from("automations").insert(DEFAULT_AUTOMATIONS.map((a) => ({ ...a, org_id: org.id }))),
    db.from("org_secrets").insert({ org_id: org.id, outbound_secret_enc: encrypt(generateSecret(), opts.encryptionKey) }),
  ])
  const failed = steps.find((s) => s.error)
  if (failed?.error) throw failed.error
  return org as { id: string; name: string; slug: string }
}
