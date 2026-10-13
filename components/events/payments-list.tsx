"use client"

import { Wallet } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useTransition } from "react"
import { markPaymentReceived } from "@/app/actions/events"
import { EmptyState } from "@/components/app/empty-state"
import { useActionToast } from "@/components/leads/lead-actions"
import { Button } from "@/components/ui/button"
import { formatDate, formatMoney } from "@/lib/format"
import type { Payment } from "@/lib/types"
import { cn } from "@/lib/utils"

const STATUS_STYLE = {
  received: "bg-success/10 text-success",
  pending: "bg-muted text-muted-foreground",
  overdue: "bg-destructive/10 text-destructive",
}

export function PaymentsList({ payments }: { payments: Payment[] }) {
  const t = useTranslations("events")
  const locale = useLocale()
  const router = useRouter()
  const notify = useActionToast()
  const [pending, start] = useTransition()

  if (payments.length === 0) {
    return (
      <div className="surface">
        <EmptyState icon={Wallet} description={t("paymentsEmpty")} compact />
      </div>
    )
  }

  return (
    <ul className="surface divide-y divide-border/60">
      {payments.map((p) => (
        <li key={p.id} className="flex items-center gap-4 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{p.label}</p>
            <p className="text-xs text-muted-foreground">
              {p.status === "received" && p.received_at
                ? formatDate(p.received_at, locale, { day: "numeric", month: "short", year: "numeric" })
                : p.due_date
                  ? t("due", { date: formatDate(p.due_date, locale, { day: "numeric", month: "short" }) })
                  : null}
            </p>
          </div>
          <span className="text-sm tabular-nums">{formatMoney(p.amount_cents, locale)}</span>
          {p.status === "received" ? (
            <span className={cn("rounded-full px-2 py-0.5 text-xs", STATUS_STYLE.received)}>{t("paymentStatus.received")}</span>
          ) : (
            <div className="flex items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-xs", STATUS_STYLE[p.status])}>{t(`paymentStatus.${p.status}`)}</span>
              <Button
                size="xs"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    notify(await markPaymentReceived(p.id))
                    router.refresh()
                  })
                }
              >
                {t("markReceived")}
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
