export const LOCALES = ["fr", "en", "nl"] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = "fr"
export const LOCALE_COOKIE = "em_locale"
