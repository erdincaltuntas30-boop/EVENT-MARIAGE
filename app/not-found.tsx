import { Compass } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { EmptyState } from "@/components/app/empty-state"
import { Button } from "@/components/ui/button"

export default async function NotFound() {
  const t = await getTranslations("notFound")
  return (
    <div className="flex min-h-svh items-center justify-center">
      <EmptyState
        icon={Compass}
        title={t("title")}
        description={t("description")}
        action={
          <Button asChild variant="outline">
            <Link href="/">{t("back")}</Link>
          </Button>
        }
      />
    </div>
  )
}
