import { AgencyForm } from "@/components/settings/agency-form"
import { requireOrg } from "@/lib/org"

export default async function AgencyPage() {
  const ctx = await requireOrg()
  return (
    <AgencyForm
      readOnly={ctx.role !== "admin"}
      org={{
        id: ctx.org.id,
        name: ctx.org.name,
        accent_color: ctx.org.accent_color,
        logo_url: ctx.org.logo_url,
        locale: ctx.org.locale,
      }}
    />
  )
}
