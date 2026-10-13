"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { serverEnv } from "@/lib/env"
import { ORG_COOKIE } from "@/lib/org"
import { provisionOrganization } from "@/lib/provision"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { supabaseServer } from "@/lib/supabase/server"
import { LOCALES, LOCALE_COOKIE } from "@/i18n/config"
import { demoReadOnly, fail, type ActionResult } from "./result"

const ONE_YEAR = 60 * 60 * 24 * 365

export async function createOrganization(_: unknown, form: FormData): Promise<ActionResult> {
  const blocked = demoReadOnly()
  if (blocked) return blocked
  const name = z.string().trim().min(2).max(80).safeParse(form.get("name"))
  if (!name.success) return fail("invalid")
  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const org = await provisionOrganization(supabaseAdmin(), {
    name: name.data,
    ownerId: user.id,
    encryptionKey: serverEnv().APP_ENCRYPTION_KEY,
  })
  ;(await cookies()).set(ORG_COOKIE, org.id, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" })
  redirect("/")
}

export async function switchOrganization(orgId: string) {
  // L'appartenance est revérifiée par getOrgContext (un cookie arbitraire est ignoré).
  ;(await cookies()).set(ORG_COOKIE, orgId, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" })
  redirect("/")
}

export async function setLocale(locale: string) {
  if (!(LOCALES as readonly string[]).includes(locale)) return
  ;(await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" })
}

export async function signOut() {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  redirect("/login")
}
