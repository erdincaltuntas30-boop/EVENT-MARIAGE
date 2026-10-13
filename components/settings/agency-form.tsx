"use client"

import { ImagePlus, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { updateAgency } from "@/app/actions/settings"
import { useActionToast } from "@/components/leads/lead-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabaseBrowser } from "@/lib/supabase/browser"
import { cn } from "@/lib/utils"

const LOCALE_NAMES: Record<string, string> = { fr: "Français", en: "English", nl: "Nederlands" }
const PRESETS = ["#4F6B5A", "#B5654A", "#1F2A44", "#A8875A", "#7A5C7E", "#3E6B78"]

interface AgencyFormProps {
  readOnly: boolean
  org: { id: string; name: string; accent_color: string; logo_url: string | null; locale: string }
}

export function AgencyForm({ org, readOnly }: AgencyFormProps) {
  const t = useTranslations()
  const router = useRouter()
  const notify = useActionToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(org.name)
  const [accent, setAccent] = useState(org.accent_color.toUpperCase())
  const [logo, setLogo] = useState(org.logo_url)
  const [locale, setLocale] = useState(org.locale)
  const [uploading, setUploading] = useState(false)
  const [pending, start] = useTransition()

  async function upload(file: File) {
    setUploading(true)
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png"
    const path = `${org.id}/logo-${Date.now()}.${ext}`
    const supabase = supabaseBrowser()
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true, contentType: file.type })
    setUploading(false)
    if (error) return toast.error(error.message)
    setLogo(supabase.storage.from("logos").getPublicUrl(path).data.publicUrl)
  }

  function save() {
    start(async () => {
      notify(await updateAgency({ name, accent_color: accent, logo_url: logo ?? "", locale: locale as "fr" }))
      router.refresh()
    })
  }

  return (
    <div className="space-y-10" style={{ "--brand": accent } as React.CSSProperties}>
      {readOnly && <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{t("common.adminOnly")}</p>}
      <h2 className="text-2xl">{t("settings.agency.title")}</h2>

      <div className="space-y-2">
        <Label htmlFor="agency-name">{t("settings.agency.name")}</Label>
        <Input id="agency-name" value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} className="h-11 max-w-md bg-card" />
      </div>

      <div className="space-y-3">
        <Label>{t("settings.agency.logo")}</Label>
        <div className="flex items-center gap-5">
          <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-soft)]">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="size-full object-cover" />
            ) : (
              <span className="font-display text-3xl text-primary">{name.charAt(0)}</span>
            )}
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
              <Button variant="outline" className="bg-card" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                {t("settings.agency.uploadLogo")}
              </Button>
              {logo && (
                <Button variant="ghost" onClick={() => setLogo(null)}>
                  {t("settings.agency.removeLogo")}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <Label>{t("settings.agency.accent")}</Label>
        <p className="text-xs text-muted-foreground">{t("settings.agency.accentHint")}</p>
        <div className="flex flex-wrap items-center gap-3">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              disabled={readOnly}
              aria-label={c}
              onClick={() => setAccent(c)}
              className={cn(
                "size-9 rounded-full ring-offset-2 ring-offset-background transition",
                accent === c ? "ring-2 ring-foreground/40" : "hover:scale-105",
              )}
              style={{ background: c }}
            />
          ))}
          <Input
            value={accent}
            onChange={(e) => setAccent(e.target.value.toUpperCase())}
            disabled={readOnly}
            className="h-9 w-28 bg-card font-mono text-xs"
            maxLength={7}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("settings.agency.language")}</Label>
        <Select value={locale} onValueChange={setLocale} disabled={readOnly}>
          <SelectTrigger className="w-56 bg-card">
            <SelectValue>{LOCALE_NAMES[locale] ?? locale}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fr">Français</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="nl">Nederlands</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!readOnly && (
        <Button onClick={save} disabled={pending || !/^#[0-9A-F]{6}$/.test(accent)} className="h-10 px-6">
          {pending ? t("common.saving") : t("common.save")}
        </Button>
      )}
    </div>
  )
}
