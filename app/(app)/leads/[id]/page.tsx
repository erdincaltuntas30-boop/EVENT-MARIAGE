import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { ActivityList } from "@/components/app/activity-list"
import { SectionTitle } from "@/components/app/page-header"
import { LeadActions } from "@/components/leads/lead-actions"
import { LeadNotes } from "@/components/leads/lead-notes"
import { SourceIcon } from "@/components/leads/source-icon"
import { formatDate, formatMoney, fullName } from "@/lib/format"
import { requireOrg } from "@/lib/org"
import { ACTIVITY_SELECT, type ActivityWithRefs } from "@/lib/activity"
import { supabaseServer } from "@/lib/supabase/server"
import type { Lead } from "@/lib/types"

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await requireOrg()
  const supabase = await supabaseServer()
  const [{ data: lead }, { data: history }] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).eq("org_id", ctx.org.id).maybeSingle(),
    supabase
      .from("automation_events")
      .select(ACTIVITY_SELECT)
      .eq("lead_id", id)
      .order("occurred_at", { ascending: false })
      .limit(100),
  ])
  if (!lead) notFound()
  const l = lead as Lead
  const t = await getTranslations()
  const locale = await getLocale()

  const responseMinutes = l.first_response_at
    ? Math.max(1, Math.round((new Date(l.first_response_at).getTime() - new Date(l.created_at).getTime()) / 60000))
    : null

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: t("leads.detail.weddingDate"), value: formatDate(l.wedding_date, locale) },
    { label: t("leads.detail.budget"), value: formatMoney(l.budget_cents, locale) },
    { label: t("leads.detail.guests"), value: l.guest_count ?? "—" },
    { label: t("leads.detail.venue"), value: l.venue ?? "—" },
    {
      label: t("leads.detail.source"),
      value: (
        <span className="inline-flex items-center gap-1.5">
          <SourceIcon source={l.source} />
          {t(`sources.${l.source}`)}
        </span>
      ),
    },
    {
      label: t("leads.detail.receivedAt"),
      value: formatDate(l.created_at, locale, { dateStyle: "medium", timeStyle: "short" }),
    },
    {
      label: t("leads.detail.firstResponse"),
      value:
        responseMinutes == null ? (
          <span className="text-warning">{t("leads.detail.noResponse")}</span>
        ) : (
          t("leads.detail.firstResponseIn", { value: responseMinutes })
        ),
    },
    {
      label: t("leads.detail.contact"),
      value: (
        <span className="flex flex-col">
          {l.email && (
            <a href={`mailto:${l.email}`} className="break-all hover:underline">
              {l.email}
            </a>
          )}
          {l.phone && <span>{l.phone}</span>}
          {!l.email && !l.phone && "—"}
        </span>
      ),
    },
  ]

  return (
    <>
      <Link href="/leads" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("leads.title")}
      </Link>

      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl">{fullName(l)}</h1>
          {l.partner_name && <p className="mt-2 text-muted-foreground">{t("leads.detail.partner", { name: l.partner_name })}</p>}
        </div>
        <LeadActions leadId={l.id} stage={l.stage} />
      </header>

      <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr]">
        <div className="space-y-10">
          <dl className="surface grid grid-cols-2 gap-x-6 gap-y-6 p-6">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-xs tracking-wide text-muted-foreground uppercase">{f.label}</dt>
                <dd className="mt-1.5 text-sm break-words">{f.value}</dd>
              </div>
            ))}
          </dl>
          <section>
            <SectionTitle>{t("leads.detail.notes")}</SectionTitle>
            <LeadNotes leadId={l.id} initial={l.notes ?? ""} />
          </section>
        </div>

        <section>
          <SectionTitle>{t("leads.detail.history")}</SectionTitle>
          <div className="surface p-6">
            <ActivityList
              orgId={ctx.org.id}
              leadId={l.id}
              limit={100}
              initialData={(history ?? []) as ActivityWithRefs[]}
              showLead={false}
              variant="timeline"
              emptyText={t("leads.detail.historyEmpty")}
            />
          </div>
        </section>
      </div>
    </>
  )
}
