import { getTranslations } from "next-intl/server"
import { Integrations, type ApiKeyRow } from "@/components/settings/integrations"
import { publicEnv } from "@/lib/env"
import { requireOrg } from "@/lib/org"
import { supabaseServer } from "@/lib/supabase/server"
import type { WebhookAction } from "@/lib/types"

export default async function IntegrationsPage() {
  const ctx = await requireOrg()
  if (ctx.role !== "admin") {
    const t = await getTranslations("common")
    return <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{t("adminOnly")}</p>
  }
  const supabase = await supabaseServer()
  const [{ data: keys }, { data: hooks }] = await Promise.all([
    supabase
      .from("api_keys")
      .select("id, key_id, last4, label, created_at, expires_at, revoked_at, last_used_at")
      .eq("org_id", ctx.org.id)
      .order("created_at", { ascending: false }),
    supabase.from("org_webhooks").select("action, url").eq("org_id", ctx.org.id),
  ])

  return (
    <Integrations
      endpoint={`${publicEnv.NEXT_PUBLIC_APP_URL}/api/ingest/:type`}
      keys={(keys ?? []) as ApiKeyRow[]}
      webhooks={Object.fromEntries((hooks ?? []).map((h) => [h.action, h.url])) as Partial<Record<WebhookAction, string>>}
    />
  )
}
