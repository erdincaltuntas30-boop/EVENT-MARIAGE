"use client"

import { Zap } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useOptimistic, useTransition } from "react"
import { toggleAutomation } from "@/app/actions/automations"
import { StatusDot } from "@/components/app/status-badge"
import { useActionToast } from "@/components/leads/lead-actions"
import { Switch } from "@/components/ui/switch"
import { formatRelative, percent } from "@/lib/format"
import type { Automation, AutomationStats } from "@/lib/types"
import { cn } from "@/lib/utils"

export function AutomationCard({ automation: a, stats }: { automation: Automation; stats: AutomationStats | null }) {
  const t = useTranslations("automations")
  const locale = useLocale()
  const router = useRouter()
  const notify = useActionToast()
  const [, start] = useTransition()
  const [enabled, setEnabled] = useOptimistic(a.is_enabled)

  const runs = stats?.runs_total ?? 0
  const rate = percent(stats?.runs_success ?? 0, runs)
  const hours = Math.round(((stats?.runs_success ?? 0) * a.minutes_saved_per_run) / 60)

  return (
    <article className={cn("surface flex flex-col p-6 transition-opacity", !enabled && "opacity-70")}>
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-display text-[1.375rem] leading-snug">{a.name}</h3>
        <Switch
          checked={enabled}
          aria-label={enabled ? t("enabled") : t("paused")}
          onCheckedChange={(checked) =>
            start(async () => {
              setEnabled(checked)
              notify(await toggleAutomation(a.id, checked))
              router.refresh()
            })
          }
        />
      </div>
      {a.description && <p className="mt-2 text-sm text-muted-foreground">{a.description}</p>}
      {a.trigger_label && (
        <p className="mt-4 inline-flex items-center gap-1.5 self-start rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          <Zap className="size-3" />
          {a.trigger_label}
        </p>
      )}

      <dl className="mt-auto grid grid-cols-2 gap-4 pt-6 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">{t("runs", { count: runs })}</dt>
          <dd className={cn("mt-1 tabular-nums", runs > 0 && rate < 90 && "text-destructive")}>
            {runs > 0 ? t("successRate", { value: rate }) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{enabled ? t("enabled") : t("paused")}</dt>
          <dd className="mt-1">{hours > 0 ? t("timeSaved", { value: hours }) : "—"}</dd>
        </div>
      </dl>
      <p className="mt-4 flex items-center gap-2 border-t border-border/60 pt-4 text-xs text-muted-foreground" suppressHydrationWarning>
        {stats?.last_status && <StatusDot status={stats.last_status} />}
        {stats?.last_run_at ? t("lastRun", { when: formatRelative(stats.last_run_at, locale) }) : t("neverRun")}
      </p>
    </article>
  )
}
