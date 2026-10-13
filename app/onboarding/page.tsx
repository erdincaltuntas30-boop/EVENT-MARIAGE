import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getOrgContext } from "@/lib/org"
import { supabaseServer } from "@/lib/supabase/server"
import { OnboardingForm } from "./onboarding-form"

export default async function OnboardingPage() {
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (await getOrgContext()) redirect("/")

  const t = await getTranslations("onboarding")
  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <div className="w-full max-w-md">
        <h1 className="text-4xl">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
        <OnboardingForm />
      </div>
    </div>
  )
}
