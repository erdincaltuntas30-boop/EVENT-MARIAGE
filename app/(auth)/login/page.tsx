import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { isDemoMode } from "@/lib/env"
import { LoginForm } from "./login-form"

export async function generateMetadata() {
  const t = await getTranslations("auth")
  return { title: t("title") }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (isDemoMode) redirect("/")
  const { next } = await searchParams
  const t = await getTranslations()
  return (
    <div className="w-full max-w-sm">
      <p className="text-sm tracking-wide text-primary uppercase">{t("app.name")}</p>
      <h1 className="mt-3 text-4xl">{t("auth.title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("auth.subtitle")}</p>
      <LoginForm next={next?.startsWith("/") ? next : "/"} />
    </div>
  )
}
