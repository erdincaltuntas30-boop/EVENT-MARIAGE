"use client"

import { Check, Copy, KeyRound, Plus, RefreshCw, Send } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { createApiKey, revokeApiKey, rotateOutboundSecret, saveWebhooks, testWebhook } from "@/app/actions/settings"
import { EmptyState } from "@/components/app/empty-state"
import { SectionTitle } from "@/components/app/page-header"
import { useActionToast } from "@/components/leads/lead-actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatRelative } from "@/lib/format"
import { WEBHOOK_ACTIONS, type WebhookAction } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface ApiKeyRow {
  id: string
  key_id: string
  last4: string
  label: string
  created_at: string
  expires_at: string | null
  revoked_at: string | null
  last_used_at: string | null
}

interface IntegrationsProps {
  endpoint: string
  keys: ApiKeyRow[]
  webhooks: Partial<Record<WebhookAction, string>>
}

type Revealed = { title: string; fields: { label: string; value: string }[] }

export function Integrations({ endpoint, keys, webhooks }: IntegrationsProps) {
  const t = useTranslations("settings.integrations")
  const tc = useTranslations("common")
  const locale = useLocale()
  const router = useRouter()
  const notify = useActionToast()
  const [pending, start] = useTransition()
  const [urls, setUrls] = useState<Partial<Record<WebhookAction, string>>>(webhooks)
  const [revealed, setRevealed] = useState<Revealed | null>(null)

  const now = new Date()
  const activeKeys = keys.filter((k) => !k.revoked_at && (!k.expires_at || new Date(k.expires_at) > now))

  function newKey() {
    start(async () => {
      const res = await createApiKey("n8n", activeKeys.length > 0)
      notify(res)
      if (res.ok && res.data) {
        setRevealed({
          title: t("newKeyTitle"),
          fields: [
            { label: t("keyId"), value: String(res.data.keyId) },
            { label: t("secret"), value: String(res.data.secret) },
          ],
        })
      }
      router.refresh()
    })
  }

  function newOutboundSecret() {
    start(async () => {
      const res = await rotateOutboundSecret()
      notify(res)
      if (res.ok && res.data) {
        setRevealed({ title: t("newSecretTitle"), fields: [{ label: t("outboundSecret"), value: String(res.data.secret) }] })
      }
    })
  }

  return (
    <div className="space-y-16">
      <section>
        <SectionTitle>{t("inboundTitle")}</SectionTitle>
        <p className="-mt-2 mb-6 max-w-xl text-sm text-muted-foreground">{t("inboundDescription")}</p>

        <div className="surface space-y-6 p-6">
          <div className="space-y-2">
            <Label>{t("endpoint")}</Label>
            <CopyField value={endpoint} />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <Label>{t("keys")}</Label>
              <Button size="sm" variant={activeKeys.length ? "outline" : "default"} onClick={newKey} disabled={pending}>
                {activeKeys.length ? <RefreshCw /> : <Plus />}
                {activeKeys.length ? t("rotateKey") : t("createKey")}
              </Button>
            </div>
            {activeKeys.length > 0 && <p className="mb-3 text-xs text-muted-foreground">{t("rotateHint")}</p>}
            {keys.length === 0 ? (
              <EmptyState icon={KeyRound} description={t("keysEmpty")} compact />
            ) : (
              <ul className="divide-y divide-border/60 rounded-xl bg-muted/40">
                {keys.map((k) => {
                  const revoked = !!k.revoked_at
                  const expired = !!k.expires_at && new Date(k.expires_at) <= now
                  const expiring = !!k.expires_at && !expired
                  return (
                    <li key={k.id} className={cn("flex items-center gap-4 px-4 py-3", (revoked || expired) && "opacity-50")}>
                      <KeyRound className="size-4 text-muted-foreground" strokeWidth={1.5} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs">
                          {k.key_id} · ems_…{k.last4}
                        </p>
                        <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                          {k.last_used_at ? t("lastUsed", { when: formatRelative(k.last_used_at, locale) }) : t("neverUsed")}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          revoked || expired ? "bg-muted text-muted-foreground" : expiring ? "bg-warning/10 text-warning" : "bg-success/10 text-success",
                        )}
                        suppressHydrationWarning
                      >
                        {revoked || expired
                          ? t("keyRevoked")
                          : expiring
                            ? t("keyExpires", { when: formatRelative(k.expires_at!, locale) })
                            : t("keyActive")}
                      </span>
                      {!revoked && !expired && (
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              notify(await revokeApiKey(k.id))
                              router.refresh()
                            })
                          }
                        >
                          {t("revoke")}
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>{t("outboundTitle")}</SectionTitle>
        <p className="-mt-2 mb-6 max-w-xl text-sm text-muted-foreground">{t("outboundDescription")}</p>

        <div className="surface space-y-5 p-6">
          {WEBHOOK_ACTIONS.map((action) => (
            <div key={action} className="space-y-2">
              <Label htmlFor={action}>{t(`actions.${action.replace(".", "_") as "lead_follow_up"}`)}</Label>
              <div className="flex gap-2">
                <Input
                  id={action}
                  value={urls[action] ?? ""}
                  placeholder="https://n8n.mon-agence.fr/webhook/…"
                  onChange={(e) => setUrls((u) => ({ ...u, [action]: e.target.value }))}
                  className="bg-card font-mono text-xs"
                />
                <Button
                  variant="outline"
                  className="bg-card"
                  disabled={pending || !webhooks[action] || webhooks[action] !== urls[action]}
                  onClick={() => start(async () => notify(await testWebhook(action)))}
                >
                  <Send />
                  {t("test")}
                </Button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-5">
            <Button variant="ghost" onClick={newOutboundSecret} disabled={pending}>
              <RefreshCw />
              {t("rotateSecret")}
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  notify(await saveWebhooks(urls))
                  router.refresh()
                })
              }
            >
              {tc("save")}
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={!!revealed} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-normal">{revealed?.title}</DialogTitle>
            <DialogDescription className="text-warning">{t("newKeyWarning")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {revealed?.fields.map((f) => (
              <div key={f.label} className="space-y-2">
                <Label>{f.label}</Label>
                <CopyField value={f.value} />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CopyField({ value }: { value: string }) {
  const t = useTranslations("common")
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/60 py-1 pr-1 pl-3">
      <code className="min-w-0 flex-1 truncate text-xs">{value}</code>
      <Button
        size="xs"
        variant="ghost"
        onClick={async () => {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? <Check /> : <Copy />}
        {copied ? t("copied") : t("copy")}
      </Button>
    </div>
  )
}
