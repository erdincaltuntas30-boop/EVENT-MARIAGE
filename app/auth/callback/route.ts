import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/server"

/** Retour des liens magiques et des invitations Supabase. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next")
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/"
  if (code) {
    const supabase = await supabaseServer()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(new URL(target, url.origin))
}
