import { CalendarHeart } from "lucide-react"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { ActivityList } from "@/components/app/activity-list"
import { EmptyState } from "@/components/app/empty-state"
import { PageHeader, SectionTitle } from "@/components/app/page-header"
import { KpiGrid } from "@/components/overview/kpi-grid"
import { PeriodTabs } from "@/components/overview/period-tabs"
import { PipelineChart } from "@/components/overview/pipeline-chart"
import { daysUntil, formatDate } from "@/lib/format"
import { requireOrg } from "@/lib/org"
import { ACTIVITY_SELECT, type ActivityWithRefs } from "@/lib/activity"
import { supabaseServer } from "@/lib/supabase/server"
import type { DashboardKpis, WeddingEvent } from "@/lib/types"

const PERIODS = [7, 30, 90] as const

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const ctx = await requireOrg()
  const { periode } = await searchParams
  const days = PERIODS.find((p) => String(p) === periode) ?? 30
  const to = new Date()
  const from = new Date(to.getTime() - days * 86400_000)

  const supabase = await supabaseServer()
  const [kpis, weekly, upcoming, activity] = await Promise.all([
    supabase.rpc("dashboard_kpis", { p_org: ctx.org.id, p_from: from.toISOString(), p_to: to.toISOString() }),
    supabase.rpc("weekly_pipeline", { p_org: ctx.org.id, p_weeks: 12 }),
    supabase
      .from("events")
      .select("*")
      .eq("org_id", ctx.org.id)
      .eq("status", "planned")
      .gte("date", to.toISOString().slice(0, 10))
      .order("date")
      .limit(5),
    supabase
      .from("automation_events")
      .select(ACTIVITY_SELECT)
      .eq("org_id", ctx.org.id)
      .order("occurred_at", { ascending: false })
      .limit(15),
  ])

  const t = await getTranslations()
  const locale = await getLocale()
  const firstName = ctx.fullName.split(" ")[0]
  const events = (upcoming.data ?? []) as WeddingEvent[]

  return (
    <>
      <PageHeader
        title={t("overview.title", { name: firstName })}
        subtitle={t("overview.subtitle", { org: ctx.org.name, period: t(`periods.${days}`) })}
        actions={<PeriodTabs value={days} />}
      />

      <KpiGrid kpis={kpis.data as DashboardKpis | null} />

      <div className="mt-12 grid gap-8 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-12">
          <section className="surface p-6">
            <SectionTitle aside={<span className="text-xs text-muted-foreground">{t("overview.chart.subtitle")}</span>}>
              {t("overview.chart.title")}
            </SectionTitle>
            <PipelineChart data={(weekly.data ?? []) as { week: string; leads: number; signed: number }[]} />
          </section>

          <section>
            <SectionTitle
              aside={
                <Link href="/evenements" className="text-xs text-muted-foreground hover:text-foreground">
                  {t("common.seeAll")}
                </Link>
              }
            >
              {t("overview.upcoming.title")}
            </SectionTitle>
            {events.length === 0 ? (
              <div className="surface">
                <EmptyState icon={CalendarHeart} description={t("overview.upcoming.empty")} compact />
              </div>
            ) : (
              <ul className="surface divide-y divide-border/60">
                {events.map((e) => (
                  <li key={e.id}>
                    <Link href={`/evenements/${e.id}`} className="flex items-center gap-5 px-6 py-4 hover:bg-muted/40">
                      <div className="w-14 text-center">
                        <div className="font-display text-3xl leading-none">{formatDate(e.date, locale, { day: "numeric" })}</div>
                        <div className="mt-1 text-[11px] tracking-wide text-muted-foreground uppercase">
                          {formatDate(e.date, locale, { month: "short" })}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{e.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[e.venue, e.guest_count ? t("common.guests", { count: e.guest_count }) : null].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">{t("common.inDays", { count: daysUntil(e.date) })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="surface self-start p-6">
          <SectionTitle
            aside={
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
                {t("overview.activity.live")}
              </span>
            }
          >
            {t("overview.activity.title")}
          </SectionTitle>
          <ActivityList
            orgId={ctx.org.id}
            limit={15}
            initialData={(activity.data ?? []) as ActivityWithRefs[]}
            emptyText={t("overview.activity.empty")}
          />
        </section>
      </div>
    </>
  )
}
