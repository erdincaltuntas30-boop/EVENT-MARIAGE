import { FlaskConical } from "lucide-react"
import { useTranslations } from "next-intl"

export function DemoBanner() {
  const t = useTranslations("demo")
  return (
    <div className="flex items-center justify-center gap-2 bg-accent px-4 py-2 text-xs text-accent-foreground">
      <FlaskConical className="size-3.5" strokeWidth={1.75} />
      {t("banner")}
    </div>
  )
}
