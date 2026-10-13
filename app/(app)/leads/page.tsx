import { getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/app/page-header"
import { LeadsBoard } from "@/components/leads/leads-board"
import { requireOrg } from "@/lib/org"
import { supabaseServer } from "@/lib/supabase/server"
import type { Lead } from "@/lib/types"

export async function generateMetadata() {
  return { title: (await getTranslations("leads"))("title") }
}

export default async function LeadsPage() {
  const ctx = await requireOrg()
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("leads")
    .select("*")
    .eq("org_id", ctx.org.id)
    .order("created_at", { ascending: false })
  const leads = (data ?? []) as Lead[]
  const t = await getTranslations("leads")
  const open = leads.filter((l) => l.stage !== "won" && l.stage !== "lost").length

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle", { count: open })} />
      <LeadsBoard orgId={ctx.org.id} initialLeads={leads} />
    </>
  )
}
