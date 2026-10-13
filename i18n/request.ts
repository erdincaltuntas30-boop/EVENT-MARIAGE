import { cookies } from "next/headers"
import { getRequestConfig } from "next-intl/server"
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, type Locale } from "./config"

export default getRequestConfig(async () => {
  const wanted = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale: Locale = (LOCALES as readonly string[]).includes(wanted ?? "") ? (wanted as Locale) : DEFAULT_LOCALE
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: "Europe/Paris",
  }
})
