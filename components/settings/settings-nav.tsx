"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/reglages/agence", key: "agency" },
  { href: "/reglages/equipe", key: "team" },
  { href: "/reglages/integrations", key: "integrations" },
] as const

export function SettingsNav() {
  const t = useTranslations("settings.tabs")
  const pathname = usePathname()
  return (
    <nav className="flex gap-6 border-b border-border">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "-mb-px border-b-2 pb-3 text-sm transition-colors",
            pathname.startsWith(tab.href)
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  )
}
