"use client"

import { useTranslations } from "next-intl"
import { useActionState } from "react"
import { createOrganization } from "@/app/actions/org"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function OnboardingForm() {
  const t = useTranslations()
  const [state, action, pending] = useActionState(createOrganization, null)
  return (
    <form action={action} className="mt-10 space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">{t("onboarding.name")}</Label>
        <Input id="name" name="name" required minLength={2} placeholder={t("onboarding.placeholder")} className="h-11 bg-card" />
      </div>
      {state && !state.ok && <p className="text-sm text-destructive">{t(`actions.${state.code}` as "actions.invalid")}</p>}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {t("onboarding.submit")}
      </Button>
    </form>
  )
}
