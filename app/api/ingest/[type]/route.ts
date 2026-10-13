import { NextResponse } from "next/server"
import { z } from "zod"
import { supabaseAdmin } from "@/lib/supabase/admin"
import { authenticateIngest } from "@/lib/ingest/auth"
import { HANDLERS, IngestError, type Outcome } from "@/lib/ingest/handlers"
import { SupabaseIngestRepo } from "@/lib/ingest/repo"
import { extractItems, INGEST_SCHEMAS, INGEST_TYPES, isIngestType, MAX_BATCH } from "@/lib/ingest/schemas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = 512 * 1024

export async function POST(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params
  if (!isIngestType(type)) {
    return NextResponse.json({ error: `Type inconnu. Types acceptés : ${INGEST_TYPES.join(", ")}` }, { status: 404 })
  }

  const rawBody = await request.text()
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Corps trop volumineux (512 Ko max)" }, { status: 413 })
  }

  const db = supabaseAdmin()
  const auth = await authenticateIngest(db, request.headers, rawBody)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const items = extractItems(body)
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Envoyez un objet ou { items: [...] }" }, { status: 400 })
  }
  if (items.length > MAX_BATCH) {
    return NextResponse.json({ error: `${MAX_BATCH} éléments maximum par appel` }, { status: 400 })
  }

  const schema: z.ZodType = INGEST_SCHEMAS[type]
  const parsed = items.map((item) => schema.safeParse(item))
  const invalid = parsed.flatMap((p, index) => (p.success ? [] : [{ index, issues: z.flattenError(p.error) }]))
  if (invalid.length > 0) {
    return NextResponse.json({ error: "Payload invalide", details: invalid }, { status: 400 })
  }

  const repo = new SupabaseIngestRepo(db)
  const counts: Record<Outcome, number> = { created: 0, updated: 0, unchanged: 0 }
  try {
    // Séquentiel : un lot peut référencer des éléments créés juste avant (lead puis mariage).
    for (const p of parsed) {
      counts[await HANDLERS[type](repo, auth.orgId, p.data)]++
    }
  } catch (e) {
    if (e instanceof IngestError) return NextResponse.json({ error: e.message, ...counts }, { status: e.status })
    console.error("[ingest]", type, e)
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
  }

  return NextResponse.json({ received: items.length, ...counts })
}
