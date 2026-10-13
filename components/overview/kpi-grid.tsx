import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { formatMoney, percent } from "@/lib/format"
import type { DashboardKpis } from "@/lib/types"
import { cn } from "@/lib/utils"

interface Tile {
  label: string
  value: string
  hint?: string
  delta?: number | null
  /** Pour le délai de réponse, une baisse est une bonne nouvelle. */
  lowerIsBetter?: boolean
}

function delta(current: number | null, previous: number | null) {
  if (current == null || previous == null || previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export async function KpiGrid({ kpis }: { kpis: DashboardKpis | null }) {
  const t = await getTranslations("overview.kpi")
  const locale = await getLocale()
  const c = kpis?.current
  const p = kpis?.previous

  const conv = c ? percent(c.won_leads, c.new_leads) : 0
  const convPrev = p ? percent(p.won_leads, p.new_leads) : 0

  const tiles: Tile[] = [
    { label: t("newLeads"), value: String(c?.new_leads ?? 0), delta: delta(c?.new_leads ?? 0, p?.new_leads ?? 0) },
    { label: t("conversion"), value: `${conv} %`, delta: delta(conv, convPrev) },
    {
      label: t("signedRevenue"),
      value: formatMoney(c?.signed_revenue_cents ?? 0, locale, true),
      delta: delta(c?.signed_revenue_cents ?? 0, p?.signed_revenue_cents ?? 0),
    },
    {
      label: t("forecastRevenue"),
      value: formatMoney(kpis?.forecast_revenue_cents ?? 0, locale, true),
      hint: t("forecastHint", { count: kpis?.open_leads ?? 0 }),
    },
    {
      label: t("firstResponse"),
      value: c?.avg_first_response_minutes == null ? "—" : t("firstResponseValue", { value: Math.round(c.avg_first_response_minutes) }),
      delta: delta(c?.avg_first_response_minutes ?? null, p?.avg_first_response_minutes ?? null),
      lowerIsBetter: true,
    },
    {
      label: t("hoursSaved"),
      value: `${Math.round(c?.hours_saved ?? 0)} h`,
      hint: t("hoursSavedHint"),
      delta: delta(c?.hours_saved ?? 0, p?.hours_saved ?? 0),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((tile) => (
        <div key={tile.label} className="min-w-0">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">{tile.label}</p>
          <p className="font-display mt-2 text-[2.5rem] leading-none tabular-nums">{tile.value}</p>
          {tile.delta != null ? (
            <DeltaLabel value={tile.delta} lowerIsBetter={tile.lowerIsBetter} label={t("vsPrevious")} />
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{tile.hint ?? " "}</p>
          )}
        </div>
      ))}
    </div>
  )
}

function DeltaLabel({ value, lowerIsBetter, label }: { value: number; lowerIsBetter?: boolean; label: string }) {
  const good = lowerIsBetter ? value <= 0 : value >= 0
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight
  return (
    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground" title={label}>
      <span className={cn("inline-flex items-center", good ? "text-success" : "text-destructive")}>
        <Icon className="size-3.5" />
        {Math.abs(value)} %
      </span>
    </p>
  )
}
