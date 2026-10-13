"use client"

import { Loader2, Send, Undo2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useTransition } from "react"
import { toast } from "sonner"
import { followUpLead, moveLeadStage, sendProposal } from "@/app/actions/leads"
import type { ActionResult } from "@/app/actions/result"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LEAD_STAGES, type LeadStage } from "@/lib/types"

export function useActionToast() {
  const t = useTranslations("actions")
  return (res: ActionResult) => {
    const title = t(res.code as "unknown")
    if (res.ok) toast.success(title)
    else toast.error(title, { description: res.message })
  }
}

export function LeadActions({ leadId, stage }: { leadId: string; stage: LeadStage }) {
  const t = useTranslations()
  const router = useRouter()
  const notify = useActionToast()
  const [pending, start] = useTransition()

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      notify(await fn())
      router.refresh()
    })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={stage} onValueChange={(v) => run(() => moveLeadStage(leadId, v as LeadStage))} disabled={pending}>
        <SelectTrigger className="w-44 bg-card">
          <span className="text-muted-foreground">{t("leads.detail.stage")} :</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LEAD_STAGES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`stages.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" className="bg-card" disabled={pending} onClick={() => run(() => followUpLead(leadId))}>
        {pending ? <Loader2 className="animate-spin" /> : <Undo2 />}
        {t("leads.detail.followUp")}
      </Button>
      <Button disabled={pending || stage === "won"} onClick={() => run(() => sendProposal(leadId))}>
        <Send />
        {t("leads.detail.sendProposal")}
      </Button>
    </div>
  )
}
