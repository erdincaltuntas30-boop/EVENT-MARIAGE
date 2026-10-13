"use client"

import { Bot, Hand, Radio } from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { EmptyState } from "@/components/app/empty-state"
import { StatusDot } from "@/components/app/status-badge"
import { formatDate, formatRelative, fullName } from "@/lib/format"
import { type ActivityWithRefs, useActivity } from "@/lib/queries"
import { cn } from "@/lib/utils"

const ACTOR_ICON = { automation: Bot, user: Hand, system: Radio }

export function ActivityList({
  orgId,
  leadId,
  eventId,
  initialData,
  limit,
  showLead = true,
  emptyText,
  variant = "feed",
}: {
  orgId: string
  leadId?: string
  eventId?: string
  initialData: ActivityWithRefs[]
  limit?: number
  showLead?: boolean
  emptyText: string
  variant?: "feed" | "timeline"
}) {
  const { data = [] } = useActivity({ orgId, leadId, eventId, limit, initialData })
  const t = useTranslations()
  const locale = useLocale()

  if (data.length === 0) return <EmptyState icon={Radio} description={emptyText} compact />

  return (
    <ol className={cn("relative", variant === "timeline" && "ml-1 border-l border-border pl-6")}>
      {data.map((item) => {
        const ActorIcon = ACTOR_ICON[item.actor]
        return (
          <li
            key={item.id}
            className={cn(
              "relative py-3 animate-in fade-in slide-in-from-top-1 duration-500",
              variant === "feed" && "border-b border-border/60 last:border-0",
            )}
          >
            {variant === "timeline" && (
              <span className="absolute top-[18px] -left-[29px] flex size-[9px] items-center justify-center">
                <StatusDot status={item.status} className="size-[9px] ring-4 ring-card" />
              </span>
            )}
            <div className="flex items-start gap-3">
              {variant === "feed" && <StatusDot status={item.status} className="mt-1.5" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">{item.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <ActorIcon className="size-3" strokeWidth={1.75} />
                    {item.automations?.name ?? t(`actors.${item.actor}`)}
                  </span>
                  {showLead && item.leads && item.lead_id && (
                    <>
                      <span aria-hidden>·</span>
                      <Link href={`/leads/${item.lead_id}`} className="hover:text-foreground hover:underline">
                        {fullName(item.leads)}
                      </Link>
                    </>
                  )}
                  {item.status === "pending" && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="text-warning">{t("status.pending")}</span>
                    </>
                  )}
                </p>
                {item.status === "error" && item.error_message && (
                  <p className="mt-1.5 rounded-md bg-destructive/8 px-2 py-1 text-xs text-destructive">{item.error_message}</p>
                )}
              </div>
              <time
                className="shrink-0 text-xs text-muted-foreground tabular-nums"
                dateTime={item.occurred_at}
                title={formatDate(item.occurred_at, locale, { dateStyle: "medium", timeStyle: "short" })}
                suppressHydrationWarning
              >
                {formatRelative(item.occurred_at, locale)}
              </time>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
