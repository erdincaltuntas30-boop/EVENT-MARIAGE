"use client"

import { useLocale, useTranslations } from "next-intl"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatDate } from "@/lib/format"

export function PipelineChart({ data }: { data: { week: string; leads: number; signed: number }[] }) {
  const t = useTranslations("overview.chart")
  const locale = useLocale()
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={3} margin={{ left: -20, right: 0, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="week"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickFormatter={(w: string) => formatDate(w, locale, { day: "numeric", month: "short" })}
            interval="preserveStartEnd"
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            contentStyle={{
              borderRadius: 12,
              border: "none",
              boxShadow: "var(--shadow-soft)",
              fontSize: 12,
              background: "var(--card)",
            }}
            labelFormatter={(w) => formatDate(String(w), locale)}
            formatter={(value, name) => [value, name === "leads" ? t("leads") : t("signed")]}
          />
          <Bar dataKey="leads" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="signed" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex gap-5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-chart-2" />
          {t("leads")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-chart-1" />
          {t("signed")}
        </span>
      </div>
    </div>
  )
}
