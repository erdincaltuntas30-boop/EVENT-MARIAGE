"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { updateLeadNotes } from "@/app/actions/leads"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useActionToast } from "./lead-actions"

export function LeadNotes({ leadId, initial }: { leadId: string; initial: string }) {
  const t = useTranslations()
  const notify = useActionToast()
  const [value, setValue] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [pending, start] = useTransition()

  return (
    <div className="surface p-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("leads.detail.notesPlaceholder")}
        className="min-h-32 resize-y border-0 bg-transparent shadow-none focus-visible:ring-0"
      />
      {value !== saved && (
        <div className="flex justify-end p-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await updateLeadNotes(leadId, value)
                notify(res)
                if (res.ok) setSaved(value)
              })
            }
          >
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      )}
    </div>
  )
}
