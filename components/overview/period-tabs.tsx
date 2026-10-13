import Link from "next/link"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

export function PeriodTabs({ value }: { value: number }) {
  const t = useTranslations("periods")
  return (
    <div className="inline-flex rounded-full bg-muted p-1">
      {([7, 30, 90] as const).map((p) => (
        <Link
          key={p}
          href={`/?periode=${p}`}
          scroll={false}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs text-muted-foreground transition-colors",
            p === value ? "bg-card text-foreground shadow-[var(--shadow-soft)]" : "hover:text-foreground",
          )}
        >
          {t(String(p) as "7")}
        </Link>
      ))}
    </div>
  )
}
