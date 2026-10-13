import { getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/app/page-header"
import { EventsView, type EventRow } from "@/components/events/events-view"
import { requireOrg } from "@/lib/org"
import { supabaseServer } from "@/lib/supabase/server"

export async function generateMetadata() {
  return { title: (await getTranslations("events"))("title") }
}

export default async function EventsPage() {
  const ctx = await requireOrg()
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from("events")
    .select("*, event_tasks(done_at), payments(status, amount_cents)")
    .eq("org_id", ctx.org.id)
    .neq("status", "cancelled")
    .order("date")
  const events = (data ?? []) as EventRow[]
  const today = new Date().toISOString().slice(0, 10)
  const t = await getTranslations("events")

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle", { count: events.filter((e) => e.date >= today).length })} />
      <EventsView events={events} today={today} />
    </>
  )
}
