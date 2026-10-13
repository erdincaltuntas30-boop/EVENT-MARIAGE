"use client"

import { AlertTriangle, RotateCw } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { retryActivity } from "@/app/actions/automations"
import { useActionToast } from "@/components/leads/lead-actions"
import { Button } from "@/components/ui/button"
import { formatRelative, fullName } from "@/lib/format"
import type { ActivityWithRefs } from "@/lib/activity"

export function ErrorsToFix({ errors }: { errors: ActivityWithRefs[] }) {
  const t = useTranslations("automations")
  const locale = useLocale()
  const router = useRouter()
  const notify = useActionToast()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, start] = useTransition()

  return (
    <div className="surface overflow-hidden">
      <p className="bg-destructive/6 px-6 py-3 text-sm text-destructive">{t("toFixDescription")}</p>
      <ul className="divide-y divide-border/60">
        {errors.map((e) => (
          <li key={e.id} className="flex items-start gap-4 px-6 py-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <p className="text-sm">{e.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground" suppressHydrationWarning>
                {[e.automations?.name, formatRelative(e.occurred_at, locale)].filter(Boolean).join(" · ")}
                {e.leads && e.lead_id && (
                  <>
                    {" · "}
                    <Link href={`/leads/${e.lead_id}`} className="hover:text-foreground hover:underline">
                      {fullName(e.leads)}
                    </Link>
                  </>
                )}
              </p>
              {e.error_message && <p className="mt-1.5 text-xs text-destructive">{e.error_message}</p>}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="bg-card"
              disabled={pendingId === e.id}
              onClick={() => {
                setPendingId(e.id)
                start(async () => {
                  notify(await retryActivity(e.id))
                  setPendingId(null)
                  router.refresh()
                })
              }}
            >
              <RotateCw className={pendingId === e.id ? "animate-spin" : undefined} />
              {t("retry")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
