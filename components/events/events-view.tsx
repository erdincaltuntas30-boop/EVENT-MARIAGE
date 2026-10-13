"use client"

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { CalendarHeart, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { EmptyState } from "@/components/app/empty-state"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate, formatMoney, percent } from "@/lib/format"
import type { PaymentStatus, WeddingEvent } from "@/lib/types"
import { cn } from "@/lib/utils"

export type EventRow = WeddingEvent & {
  event_tasks: { done_at: string | null }[]
  payments: { status: PaymentStatus; amount_cents: number }[]
}

export function EventsView({ events, today }: { events: EventRow[]; today: string }) {
  const t = useTranslations("events")
  if (events.length === 0) {
    return (
      <div className="surface">
        <EmptyState icon={CalendarHeart} title={t("emptyTitle")} description={t("emptyDescription")} />
      </div>
    )
  }
  return (
    <Tabs defaultValue="list">
      <TabsList className="mb-8">
        <TabsTrigger value="list">{t("tabs.list")}</TabsTrigger>
        <TabsTrigger value="calendar">{t("tabs.calendar")}</TabsTrigger>
      </TabsList>
      <TabsContent value="list">
        <EventList events={events} today={today} />
      </TabsContent>
      <TabsContent value="calendar">
        <EventCalendar events={events} today={today} />
      </TabsContent>
    </Tabs>
  )
}

function EventList({ events, today }: { events: EventRow[]; today: string }) {
  const t = useTranslations("events")
  const locale = useLocale()
  const upcoming = events.filter((e) => e.date >= today)
  const past = events.filter((e) => e.date < today).reverse()

  const byMonth = useMemo(() => {
    const groups = new Map<string, EventRow[]>()
    for (const e of upcoming) {
      const key = e.date.slice(0, 7)
      groups.set(key, [...(groups.get(key) ?? []), e])
    }
    return [...groups.entries()]
  }, [upcoming])

  return (
    <div className="space-y-12">
      {byMonth.map(([month, items]) => (
        <section key={month}>
          <h2 className="mb-4 text-2xl capitalize">{formatDate(`${month}-01`, locale, { month: "long", year: "numeric" })}</h2>
          <ul className="surface divide-y divide-border/60">
            {items.map((e) => (
              <EventLine key={e.id} event={e} />
            ))}
          </ul>
        </section>
      ))}
      {past.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl text-muted-foreground">{t("past")}</h2>
          <ul className="surface divide-y divide-border/60 opacity-80">
            {past.map((e) => (
              <EventLine key={e.id} event={e} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function EventLine({ event: e }: { event: EventRow }) {
  const t = useTranslations()
  const locale = useLocale()
  const done = e.event_tasks.filter((x) => x.done_at).length
  const received = e.payments.filter((p) => p.status === "received").length
  const overdue = e.payments.some((p) => p.status === "overdue")
  return (
    <li>
      <Link href={`/evenements/${e.id}`} className="grid grid-cols-[3.5rem_1fr] items-center gap-5 px-6 py-5 hover:bg-muted/40 md:grid-cols-[3.5rem_minmax(0,1fr)_8rem_7rem] xl:grid-cols-[3.5rem_minmax(0,1fr)_10rem_9rem_7rem]">
        <div className="text-center">
          <div className="font-display text-3xl leading-none">{formatDate(e.date, locale, { day: "numeric" })}</div>
          <div className="mt-1 text-[11px] tracking-wide text-muted-foreground uppercase">
            {formatDate(e.date, locale, { weekday: "short" })}
          </div>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{e.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[e.venue, e.guest_count ? t("common.guests", { count: e.guest_count }) : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="hidden md:block">
          <p className="mb-1.5 text-xs text-muted-foreground">
            {t("events.checklistProgress", { done, total: e.event_tasks.length })}
          </p>
          <Progress value={percent(done, e.event_tasks.length)} className="h-1" />
        </div>
        <p className={cn("hidden text-xs xl:block", overdue ? "text-destructive" : "text-muted-foreground")}>
          {t("events.paymentsSummary", { received, total: e.payments.length })}
        </p>
        <p className="font-display hidden text-right text-lg md:block">{formatMoney(e.contract_amount_cents, locale)}</p>
      </Link>
    </li>
  )
}

function EventCalendar({ events, today }: { events: EventRow[]; today: string }) {
  const t = useTranslations("events.calendar")
  const locale = useLocale()
  const [month, setMonth] = useState(() => startOfMonth(new Date(`${today}T12:00:00`)))

  const days = eachDayOfInterval({
    start: startOfWeek(month, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })
  const byDay = useMemo(() => {
    const map = new Map<string, EventRow[]>()
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return map
  }, [events])

  return (
    <div className="surface p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-3xl capitalize">{formatDate(month, locale, { month: "long", year: "numeric" })}</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label={t("prev")} onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            {t("today")}
          </Button>
          <Button variant="ghost" size="icon" aria-label={t("next")} onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] tracking-wide text-muted-foreground uppercase">
        {days.slice(0, 7).map((d) => (
          <div key={d.toISOString()} className="pb-3">
            {formatDate(d, locale, { weekday: "short" })}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-border/60">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd")
          const items = byDay.get(key) ?? []
          return (
            <div key={key} className={cn("min-h-28 bg-card p-2", !isSameMonth(d, month) && "bg-muted/40")}>
              <div
                className={cn(
                  "mb-1 flex size-6 items-center justify-center rounded-full text-xs",
                  key === today ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {d.getDate()}
              </div>
              <div className="space-y-1">
                {items.map((e) => (
                  <Link
                    key={e.id}
                    href={`/evenements/${e.id}`}
                    className="block truncate rounded-md bg-accent px-1.5 py-1 text-[11px] text-accent-foreground hover:brightness-95"
                    title={e.title}
                  >
                    {e.couple_names ?? e.title}
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
