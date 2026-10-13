"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabaseBrowser } from "@/lib/supabase/browser"

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("auth")
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null)

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setMessage(null)
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password })
    setPending(false)
    if (error) return setMessage({ kind: "error", text: t("error") })
    router.replace(next)
    router.refresh()
  }

  async function magicLink() {
    if (!email) return
    setPending(true)
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    setPending(false)
    setMessage(error ? { kind: "error", text: error.message } : { kind: "info", text: t("magicLinkSent") })
  }

  return (
    <form onSubmit={signIn} className="mt-10 space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 bg-card" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 bg-card" />
      </div>
      {message && (
        <p className={message.kind === "error" ? "text-sm text-destructive" : "text-sm text-success"}>{message.text}</p>
      )}
      <Button type="submit" className="h-11 w-full" disabled={pending || !password}>
        {t("signIn")}
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("or")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button type="button" variant="ghost" className="h-11 w-full" disabled={pending || !email} onClick={magicLink}>
        {t("magicLink")}
      </Button>
    </form>
  )
}
