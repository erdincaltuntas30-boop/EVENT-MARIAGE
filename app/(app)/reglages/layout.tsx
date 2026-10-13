import { getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/app/page-header"
import { SettingsNav } from "@/components/settings/settings-nav"

export async function generateMetadata() {
  return { title: (await getTranslations("settings"))("title") }
}

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("settings")
  return (
    <>
      <PageHeader title={t("title")} />
      <SettingsNav />
      <div className="mt-10 max-w-3xl">{children}</div>
    </>
  )
}
