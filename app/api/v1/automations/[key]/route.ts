import { NextResponse } from "next/server"
import { isDemoMode } from "@/lib/env"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { authenticateIngest } from "@/lib/ingest/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Permet à n8n de vérifier, avant d'agir, si une automatisation est en pause dans l'app.
 * Même authentification que l'ingestion ; la signature porte sur un corps vide.
 */
export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  if (isDemoMode) return NextResponse.json({ error: "Mode démo : l'API n'est pas disponible tant que Supabase n'est pas configuré." }, { status: 503 })
  const { key } = await params
  const db = supabaseAdmin()
  const auth = await authenticateIngest(db, request.headers, "")
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  const { data } = await db
    .from("automations")
    .select("key, name, is_enabled")
    .eq("org_id", auth.orgId)
    .eq("key", key)
    .maybeSingle()

  if (!data) return NextResponse.json({ key, enabled: false, known: false })
  return NextResponse.json({ key: data.key, name: data.name, enabled: data.is_enabled, known: true })
}
