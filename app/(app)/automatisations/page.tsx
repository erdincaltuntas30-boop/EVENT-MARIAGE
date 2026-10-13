import { CheckCircle2, Sparkles } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { EmptyState } from "@/components/app/empty-state"
import { PageHeader, SectionTitle } from "@/components/app/page-header"
import { AutomationCard } from "@/components/automations/automation-card"
import { ErrorsToFix } from "@/components/automations/errors-to-fix"
import { requireOrg } from "@/lib/org"
import { ACTIVITY_SELECT, type ActivityWithRefs } from "@/lib/queries"
import { supabaseServer } from "@/lib/supabase/server"
import type { Automation, AutomationStats } from "@/lib/types"

export async function generateMetadata() {
  return { title: (await getTranslations("automations"))("title") }
}

const CATEGORIES = ["leads", "events", "other"] as const

export default async function AutomationsPage() {
  const ctx = await requireOrg()
  const supabase = await supabaseServer()
  const since = new Date(Date.now() - 30 * 86400_000).toISOString()
  const [{ data: automations }, { data: stats }, { data: errors }] = await Promise.all([
    supabase.from("automations").select("*").eq("org_id", ctx.org.id).order("created_at"),
    supabase.from("automation_stats").select("*").eq("org_id", ctx.org.id),
    supabase
      .from("automation_events")
      .select(ACTIVITY_SELECT)
      .eq("org_id", ctx.org.id)
      .eq("status", "error")
      .gte("occurred_at", since)
      .is("detail->>retried_by", null)
      .order("occurred_at", { ascending: false })
      .limit(20),
  ])
  const t = await getTranslations("automations")
  const list = (automations ?? []) as Automation[]
  const statsById = new Map(((stats ?? []) as AutomationStats[]).map((s) => [s.automation_id, s]))
  const errorList = (errors ?? []) as ActivityWithRefs[]

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <section className="mb-14">
        <SectionTitle>{t("toFix")}</SectionTitle>
        {errorList.length === 0 ? (
          <div className="surface flex items-center gap-3 px-6 py-5 text-sm text-muted-foreground">
            <CheckCircle2 className="size-5 text-success" strokeWidth={1.5} />
            {t("allGood")}
          </div>
        ) : (
          <ErrorsToFix errors={errorList} />
        )}
      </section>

      {list.length === 0 ? (
        <div className="surface">
          <EmptyState icon={Sparkles} title={t("emptyTitle")} description={t("emptyDescription")} />
        </div>
      ) : (
        CATEGORIES.map((cat) => {
          const items = list.filter((a) => (CATEGORIES as readonly string[]).includes(a.category) ? a.category === cat : cat === "other")
          if (items.length === 0) return null
          return (
            <section key={cat} className="mb-14">
              <SectionTitle>{t(`categories.${cat}`)}</SectionTitle>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {items.map((a) => (
                  <AutomationCard key={a.id} automation={a} stats={statsById.get(a.id) ?? null} />
                ))}
              </div>
            </section>
          )
        })
      )}
    </>
  )
}
