"use client"

import { CalendarHeart, ChevronsUpDown, Languages, LayoutDashboard, LogOut, Settings, Sparkles, Users } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useTransition } from "react"
import { setLocale, signOut, switchOrganization } from "@/app/actions/org"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LOCALES } from "@/i18n/config"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", key: "overview", icon: LayoutDashboard },
  { href: "/leads", key: "leads", icon: Users },
  { href: "/evenements", key: "events", icon: CalendarHeart },
  { href: "/automatisations", key: "automations", icon: Sparkles },
  { href: "/reglages", key: "settings", icon: Settings },
] as const

const LOCALE_NAMES: Record<string, string> = { fr: "Français", en: "English", nl: "Nederlands" }

interface SidebarProps {
  org: { id: string; name: string; logoUrl: string | null }
  organizations: { id: string; name: string }[]
  user: { name: string; email: string; role: string }
}

export function Sidebar({ org, organizations, user }: SidebarProps) {
  const t = useTranslations("nav")
  const pathname = usePathname()
  const locale = useLocale()
  const router = useRouter()
  const [, startTransition] = useTransition()

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))

  return (
    <aside className="sticky top-0 hidden h-svh w-[248px] shrink-0 flex-col bg-sidebar px-4 py-6 md:flex">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-3 rounded-xl px-2 py-2 text-left outline-none hover:bg-sidebar-accent">
          {org.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt="" className="size-9 rounded-lg object-cover" />
          ) : (
            <span className="font-display flex size-9 items-center justify-center rounded-lg bg-primary text-lg text-primary-foreground">
              {org.name.charAt(0)}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{org.name}</span>
            <span className="block text-xs text-muted-foreground">Event Mariage</span>
          </span>
          {organizations.length > 1 && <ChevronsUpDown className="size-4 text-muted-foreground" />}
        </DropdownMenuTrigger>
        {organizations.length > 1 && (
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>{t("switchOrg")}</DropdownMenuLabel>
            {organizations.map((o) => (
              <DropdownMenuItem key={o.id} onSelect={() => startTransition(() => switchOrganization(o.id))}>
                {o.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        )}
      </DropdownMenu>

      <nav className="mt-10 flex flex-col gap-1">
        {NAV.map(({ href, key, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
              isActive(href) && "bg-card text-foreground shadow-[var(--shadow-soft)]",
            )}
          >
            <Icon className={cn("size-4", isActive(href) && "text-primary")} strokeWidth={1.75} />
            {t(key)}
          </Link>
        ))}
      </nav>

      <div className="mt-auto">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left outline-none hover:bg-sidebar-accent">
            <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-medium">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{user.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Languages className="size-4" />
                {t("language")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={locale}
                  onValueChange={(value) =>
                    startTransition(async () => {
                      await setLocale(value)
                      router.refresh()
                    })
                  }
                >
                  {LOCALES.map((l) => (
                    <DropdownMenuRadioItem key={l} value={l}>
                      {LOCALE_NAMES[l]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => startTransition(() => signOut())}>
              <LogOut className="size-4" />
              {t("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}

/** Navigation compacte pour les écrans étroits (la barre latérale apparaît à partir de la tablette). */
export function MobileNav({ orgName }: { orgName: string }) {
  const t = useTranslations("nav")
  const pathname = usePathname()
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))
  return (
    <header className="sticky top-0 z-30 bg-sidebar/95 backdrop-blur md:hidden">
      <p className="font-display px-5 pt-4 text-xl">{orgName}</p>
      <nav className="flex gap-1 overflow-x-auto px-3 py-2">
        {NAV.map(({ href, key, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground",
              isActive(href) && "bg-card text-foreground shadow-[var(--shadow-soft)]",
            )}
          >
            <Icon className="size-3.5" />
            {t(key)}
          </Link>
        ))}
      </nav>
    </header>
  )
}
