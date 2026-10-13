"use client"

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { useQueryClient } from "@tanstack/react-query"
import { CalendarDays, Clock, Inbox, Users } from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { moveLeadStage } from "@/app/actions/leads"
import { EmptyState } from "@/components/app/empty-state"
import { SourceIcon } from "@/components/leads/source-icon"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDate, formatMoney, formatRelative, fullName } from "@/lib/format"
import { queryKeys, useLeads } from "@/lib/queries"
import { LEAD_SOURCES, LEAD_STAGES, type Lead, type LeadStage } from "@/lib/types"
import { cn } from "@/lib/utils"

const PERIODS = ["all", "7", "30", "90"] as const

export function LeadsBoard({ orgId, initialLeads }: { orgId: string; initialLeads: Lead[] }) {
  const t = useTranslations()
  const queryClient = useQueryClient()
  const { data: leads = [] } = useLeads(orgId, initialLeads)
  const [source, setSource] = useState<string>("all")
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("all")
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const filtered = useMemo(() => {
    const minDate = period === "all" ? 0 : Date.now() - Number(period) * 86400_000
    return leads.filter(
      (l) => (source === "all" || l.source === source) && new Date(l.created_at).getTime() >= minDate,
    )
  }, [leads, source, period])

  const columns = useMemo(
    () =>
      LEAD_STAGES.map((stage) => {
        const items = filtered.filter((l) => l.stage === stage)
        return { stage, items, total: items.reduce((s, l) => s + (l.budget_cents ?? 0), 0) }
      }),
    [filtered],
  )

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const stage = e.over?.id as LeadStage | undefined
    const lead = leads.find((l) => l.id === e.active.id)
    if (!stage || !lead || lead.stage === stage) return

    const key = queryKeys.leads(orgId)
    const previous = queryClient.getQueryData<Lead[]>(key)
    queryClient.setQueryData<Lead[]>(key, (old = []) => old.map((l) => (l.id === lead.id ? { ...l, stage } : l)))

    const res = await moveLeadStage(lead.id, stage)
    if (!res.ok) {
      queryClient.setQueryData(key, previous)
      toast.error(t(`actions.${res.code}` as "actions.unknown"))
    }
  }

  if (leads.length === 0) {
    return (
      <div className="surface">
        <EmptyState icon={Inbox} title={t("leads.emptyTitle")} description={t("leads.emptyDescription")} />
      </div>
    )
  }

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-3">
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-48 bg-card">
            <span className="text-muted-foreground">{t("leads.filters.source")} :</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            {LEAD_SOURCES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`sources.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-52 bg-card">
            <span className="text-muted-foreground">{t("leads.filters.period")} :</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p} value={p}>
                {p === "all" ? t("leads.filters.anyTime") : t(`periods.${p}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="-mx-6 flex gap-4 overflow-x-auto px-6 pb-6 md:-mx-10 md:px-10 lg:-mx-14 lg:px-14">
          {columns.map((col) => (
            <Column key={col.stage} stage={col.stage} count={col.items.length} total={col.total}>
              {col.items.map((lead) => (
                <DraggableCard key={lead.id} lead={lead} />
              ))}
            </Column>
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
          {activeLead && <LeadCard lead={activeLead} dragging />}
        </DragOverlay>
      </DndContext>
    </>
  )
}

function Column({ stage, count, total, children }: { stage: LeadStage; count: number; total: number; children: React.ReactNode }) {
  const t = useTranslations()
  const locale = useLocale()
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const muted = stage === "lost"
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-[272px] shrink-0 flex-col rounded-2xl p-2 transition-colors",
        isOver ? "bg-accent" : "bg-transparent",
        muted && "opacity-75",
      )}
    >
      <header className="flex items-baseline justify-between px-2 pt-1 pb-3">
        <h2 className="font-sans text-sm font-medium">
          {t(`stages.${stage}`)}
          <span className="ml-2 text-muted-foreground tabular-nums">{count}</span>
        </h2>
        {total > 0 && <span className="text-xs text-muted-foreground tabular-nums">{formatMoney(total, locale, true)}</span>}
      </header>
      <div className="flex min-h-24 flex-col gap-2.5">
        {children}
        {count === 0 && (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            {t("leads.emptyColumn")}
          </p>
        )}
      </div>
    </section>
  )
}

function DraggableCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("touch-none", isDragging && "opacity-30")}>
      <LeadCard lead={lead} />
    </div>
  )
}

function LeadCard({ lead, dragging }: { lead: Lead; dragging?: boolean }) {
  const t = useTranslations()
  const locale = useLocale()
  const awaiting = !lead.first_response_at && (lead.stage === "new" || lead.stage === "qualified")
  return (
    <Link
      href={`/leads/${lead.id}`}
      draggable={false}
      className={cn(
        "block rounded-xl bg-card p-4 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-md",
        dragging && "rotate-1 shadow-lg",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{fullName(lead)}</p>
          {lead.partner_name && (
            <p className="truncate text-xs text-muted-foreground">{t("leads.detail.partner", { name: lead.partner_name })}</p>
          )}
        </div>
        <span className="mt-0.5 text-muted-foreground" title={t(`sources.${lead.source}`)}>
          <SourceIcon source={lead.source} />
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {lead.wedding_date && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3" />
            {formatDate(lead.wedding_date, locale, { day: "numeric", month: "short", year: "numeric" })}
          </span>
        )}
        {lead.guest_count != null && (
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" />
            {lead.guest_count}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-display text-lg leading-none">{formatMoney(lead.budget_cents, locale)}</span>
        {awaiting ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] text-warning">
            <Clock className="size-3" />
            {t("leads.noReply")}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground" suppressHydrationWarning>
            {formatRelative(lead.created_at, locale)}
          </span>
        )}
      </div>
    </Link>
  )
}
