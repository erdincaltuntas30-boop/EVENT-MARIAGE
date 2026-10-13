import { ArrowLeft, Store } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { ActivityList } from "@/components/app/activity-list"
import { EmptyState } from "@/components/app/empty-state"
import { SectionTitle } from "@/components/app/page-header"
import { Checklist } from "@/components/events/checklist"
import { PaymentsList } from "@/components/events/payments-list"
import { daysUntil, formatDate, formatMoney, percent } from "@/lib/format"
import { requireOrg } from "@/lib/org"
import { ACTIVITY_SELECT, type ActivityWithRefs } from "@/lib/activity"
import { supabaseServer } from "@/lib/supabase/server"
import type { EventTask, Payment, Vendor, WeddingEvent } from "@/lib/types"

type VendorLink = { role: string | null; amount_cents: number | null; vendors: Vendor }

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireOrg()
  const supabase = await supabaseServer()
  const [{ data: event }, { data: tasks }, { data: payments }, { data: vendors }, { data: history }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).eq("org_id", ctx.org.id).maybeSingle(),
    supabase.from("event_tasks").select("*").eq("event_id", id).order("due_date"),
    supabase.from("payments").select("*").eq("event_id", id).order("due_date"),
    supabase.from("event_vendors").select("role, amount_cents, vendors(*)").eq("event_id", id),
    supabase.from("automation_events").select(ACTIVITY_SELECT).eq("event_id", id).order("occurred_at", { ascending: false }).limit(50),
  ])
  if (!event) notFound()
  const e = event as WeddingEvent
  const t = await getTranslations()
  const locale = await getLocale()
  const taskList = (tasks ?? []) as EventTask[]
  const done = taskList.filter((x) => x.done_at).length
  const days = daysUntil(e.date)

  return (
    <>
      <Link href="/evenements" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("events.title")}
      </Link>

      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm text-primary">
            {formatDate(e.date, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {days >= 0 && <span className="text-muted-foreground"> · {t("common.inDays", { count: days })}</span>}
          </p>
          <h1 className="mt-2 text-4xl md:text-5xl">{e.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {[e.venue, e.guest_count ? t("common.guests", { count: e.guest_count }) : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">{t("events.contract")}</p>
          <p className="font-display text-4xl">{formatMoney(e.contract_amount_cents, locale)}</p>
        </div>
      </header>

      <div className="grid gap-10 xl:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionTitle aside={<span className="text-xs text-muted-foreground">{percent(done, taskList.length)} %</span>}>
            {t("events.checklist")}
          </SectionTitle>
          <Checklist tasks={taskList} />
        </section>

        <div className="space-y-10">
          <section>
            <SectionTitle>{t("events.payments")}</SectionTitle>
            <PaymentsList payments={(payments ?? []) as Payment[]} />
          </section>

          <section>
            <SectionTitle>{t("events.vendors")}</SectionTitle>
            <div className="surface">
              {(vendors ?? []).length === 0 ? (
                <EmptyState icon={Store} description={t("events.vendorsEmpty")} compact />
              ) : (
                <ul className="divide-y divide-border/60">
                  {((vendors ?? []) as unknown as VendorLink[]).map((v) => (
                    <li key={v.vendors.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{v.vendors.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[v.role ?? v.vendors.category, v.vendors.email].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {v.amount_cents != null && <span className="text-sm tabular-nums">{formatMoney(v.amount_cents, locale)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section>
            <SectionTitle>{t("events.activity")}</SectionTitle>
            <div className="surface p-6">
              <ActivityList
                orgId={ctx.org.id}
                eventId={e.id}
                limit={50}
                initialData={(history ?? []) as ActivityWithRefs[]}
                variant="timeline"
                showLead={false}
                emptyText={t("leads.detail.historyEmpty")}
              />
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
