import { TeamManager, type Member } from "@/components/settings/team-manager"
import { requireOrg } from "@/lib/org"
import { supabaseServer } from "@/lib/supabase/server"
import type { MemberRole } from "@/lib/types"

export default async function TeamPage() {
  const ctx = await requireOrg()
  const supabase = await supabaseServer()
  const { data: memberships } = await supabase
    .from("memberships")
    .select("user_id, role, created_at")
    .eq("org_id", ctx.org.id)
    .order("created_at")
  const ids = (memberships ?? []).map((m) => m.user_id)
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids)
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

  const members: Member[] = (memberships ?? []).map((m) => ({
    userId: m.user_id,
    role: m.role as MemberRole,
    name: byId.get(m.user_id)?.full_name ?? "—",
    email: byId.get(m.user_id)?.email ?? "",
  }))

  return <TeamManager members={members} currentUserId={ctx.userId} isAdmin={ctx.role === "admin"} />
}
