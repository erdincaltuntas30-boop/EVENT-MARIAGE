import { differenceInCalendarDays } from "date-fns"

const INTL_LOCALES: Record<string, string> = { fr: "fr-FR", en: "en-GB", nl: "nl-BE" }
const intlLocale = (locale: string) => INTL_LOCALES[locale] ?? "fr-FR"

export function formatMoney(cents: number | null | undefined, locale = "fr", compact = false) {
  if (cents == null) return "—"
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
    notation: compact && Math.abs(cents) >= 10_000_000 ? "compact" : "standard",
  }).format(cents / 100)
}

export function formatDate(value: string | Date | null | undefined, locale = "fr", opts?: Intl.DateTimeFormatOptions) {
  if (!value) return "—"
  const date = typeof value === "string" && value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value)
  return new Intl.DateTimeFormat(intlLocale(locale), opts ?? { day: "numeric", month: "long", year: "numeric" }).format(date)
}

export function formatRelative(value: string | Date, locale = "fr", now = new Date()) {
  const diffSec = Math.round((new Date(value).getTime() - now.getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" })
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(diffSec, "second")
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute")
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour")
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day")
  return rtf.format(Math.round(diffSec / (86400 * 30)), "month")
}

export function daysUntil(date: string, now = new Date()) {
  return differenceInCalendarDays(new Date(`${date}T12:00:00`), now)
}

export function percent(part: number, total: number) {
  return total === 0 ? 0 : Math.round((part / total) * 100)
}

export function fullName(p: { first_name: string; last_name?: string | null }) {
  return [p.first_name, p.last_name].filter(Boolean).join(" ")
}
