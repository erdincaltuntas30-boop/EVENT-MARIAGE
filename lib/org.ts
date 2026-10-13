import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabase/server"
import type { MemberRole, Organization } from "@/lib/types"

export const ORG_COOKIE = "em_org"

export interface OrgContext {
  userId: string
  email: string
  fullName: string
  org: Organization
  role: MemberRole
  organizations: Pick<Organization, "id" | "name">[]
}

/** Utilisateur + organisation courante (cookie `em_org`, sinon la première). Mis en cache par requête. */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: memberships }, { data: profile }] = await Promise.all([
    supabase
      .from("memberships")
      .select("role, organizations(*)")
      .eq("user_id", user.id)
      .order("created_at"),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ])

  const rows = (memberships ?? []) as unknown as { role: MemberRole; organizations: Organization }[]
  if (rows.length === 0) return null

  const wanted = (await cookies()).get(ORG_COOKIE)?.value
  const current = rows.find((r) => r.organizations.id === wanted) ?? rows[0]

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? user.email ?? "",
    org: current.organizations,
    role: current.role,
    organizations: rows.map((r) => ({ id: r.organizations.id, name: r.organizations.name })),
  }
})

export async function requireOrg(): Promise<OrgContext> {
  const ctx = await getOrgContext()
  if (!ctx) redirect("/onboarding")
  return ctx
}

export async function requireAdmin(): Promise<OrgContext> {
  const ctx = await requireOrg()
  if (ctx.role !== "admin") throw new Error("Réservé aux administrateurs")
  return ctx
}
