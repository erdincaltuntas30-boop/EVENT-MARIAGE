import type { SupabaseClient } from "@supabase/supabase-js"

export type Row = Record<string, unknown> & { id: string }
export type Table =
  | "leads"
  | "events"
  | "event_tasks"
  | "payments"
  | "automations"
  | "automation_events"

/** Accès minimal à la base utilisé par l'ingestion (permet de tester les handlers en mémoire). */
export interface IngestRepo {
  findOne(table: Table, orgId: string, match: Record<string, unknown>): Promise<Row | null>
  insert(table: Table, row: Record<string, unknown>): Promise<Row>
  update(table: Table, id: string, patch: Record<string, unknown>): Promise<void>
}

export class SupabaseIngestRepo implements IngestRepo {
  constructor(private readonly db: SupabaseClient) {}

  async findOne(table: Table, orgId: string, match: Record<string, unknown>) {
    const { data, error } = await this.db.from(table).select("*").eq("org_id", orgId).match(match).maybeSingle()
    if (error) throw error
    return data as Row | null
  }

  async insert(table: Table, row: Record<string, unknown>) {
    const { data, error } = await this.db.from(table).insert(row).select("*").single()
    if (error) throw error
    return data as Row
  }

  async update(table: Table, id: string, patch: Record<string, unknown>) {
    const { error } = await this.db.from(table).update(patch).eq("id", id)
    if (error) throw error
  }
}

/** Implémentation en mémoire, utilisée par les tests. */
export class MemoryIngestRepo implements IngestRepo {
  tables: Record<string, Row[]> = {}
  private seq = 0

  rows(table: Table) {
    return (this.tables[table] ??= [])
  }

  async findOne(table: Table, orgId: string, match: Record<string, unknown>) {
    return (
      this.rows(table).find((r) => r.org_id === orgId && Object.entries(match).every(([k, v]) => r[k] === v)) ?? null
    )
  }

  async insert(table: Table, row: Record<string, unknown>) {
    const rows = this.rows(table)
    if (row.external_id != null && rows.some((r) => r.org_id === row.org_id && r.external_id === row.external_id)) {
      throw Object.assign(new Error("duplicate key"), { code: "23505" })
    }
    const created = { id: `id-${++this.seq}`, ...row } as Row
    rows.push(created)
    return created
  }

  async update(table: Table, id: string, patch: Record<string, unknown>) {
    const row = this.rows(table).find((r) => r.id === id)
    if (row) Object.assign(row, patch)
  }
}
