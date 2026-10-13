/**
 * Faux client Supabase du mode démo : lit les données fictives en mémoire (sous-ensemble de
 * l'API PostgREST utilisé par l'app) et refuse toute écriture. Aucune requête réseau.
 */
import { buildDemoData, DEMO_USER_EMAIL, DEMO_USER_ID, type DemoTables } from "./data"

type Row = Record<string, unknown>
type Result = { data: unknown; error: { message: string; code: string } | null; count?: number | null }

export const DEMO_READ_ONLY_ERROR = { message: "Mode démo : les modifications sont désactivées.", code: "DEMO_READ_ONLY" }

let tables: DemoTables | null = null
const db = () => (tables ??= buildDemoData())

/** Colonne de clé étrangère d'une table embarquée « à un » (ex. leads → lead_id). */
const TO_ONE_FK: Record<string, string> = {
  organizations: "org_id",
  automations: "automation_id",
  leads: "lead_id",
  events: "event_id",
  vendors: "vendor_id",
}
/** Colonne qui pointe vers la table de base pour une relation « à plusieurs » (ex. events → event_tasks.event_id). */
const PARENT_FK: Record<string, string> = { events: "event_id", leads: "lead_id", automations: "automation_id" }

/** Découpe « *, automations(name), leads(first_name) » au premier niveau. */
function parseEmbeds(select: string) {
  const parts: string[] = []
  let depth = 0
  let current = ""
  for (const ch of select) {
    if (ch === "(") depth++
    if (ch === ")") depth--
    if (ch === "," && depth === 0) {
      parts.push(current.trim())
      current = ""
    } else current += ch
  }
  if (current.trim()) parts.push(current.trim())
  return parts.map((p) => p.match(/^(\w+)\(/)?.[1]).filter((x): x is string => !!x)
}

function readColumn(row: Row, column: string): unknown {
  const json = column.match(/^(\w+)->>(\w+)$/)
  if (json) {
    const obj = row[json[1]] as Record<string, unknown> | null
    const v = obj?.[json[2]]
    return v == null ? null : String(v)
  }
  return row[column]
}

class DemoQuery implements PromiseLike<Result> {
  private filters: ((r: Row) => boolean)[] = []
  private orders: { column: string; ascending: boolean }[] = []
  private max: number | null = null
  private mode: "many" | "single" | "maybeSingle" = "many"
  private embeds: string[] = []
  private write = false

  constructor(private readonly table: string) {}

  select(columns = "*") {
    this.embeds = parseEmbeds(columns)
    return this
  }
  insert() {
    this.write = true
    return this
  }
  update() {
    this.write = true
    return this
  }
  upsert() {
    this.write = true
    return this
  }
  delete() {
    this.write = true
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push((r) => readColumn(r, column) === value)
    return this
  }
  neq(column: string, value: unknown) {
    this.filters.push((r) => readColumn(r, column) !== value)
    return this
  }
  gt(column: string, value: string | number) {
    this.filters.push((r) => (readColumn(r, column) as string | number) > value)
    return this
  }
  gte(column: string, value: string | number) {
    this.filters.push((r) => (readColumn(r, column) as string | number) >= value)
    return this
  }
  lt(column: string, value: string | number) {
    this.filters.push((r) => (readColumn(r, column) as string | number) < value)
    return this
  }
  lte(column: string, value: string | number) {
    this.filters.push((r) => (readColumn(r, column) as string | number) <= value)
    return this
  }
  in(column: string, values: unknown[]) {
    this.filters.push((r) => values.includes(readColumn(r, column)))
    return this
  }
  is(column: string, value: null | boolean) {
    this.filters.push((r) => (readColumn(r, column) ?? null) === value)
    return this
  }
  match(query: Record<string, unknown>) {
    for (const [k, v] of Object.entries(query)) this.eq(k, v)
    return this
  }
  or() {
    return this
  }
  order(column: string, opts: { ascending?: boolean } = {}) {
    this.orders.push({ column, ascending: opts.ascending ?? true })
    return this
  }
  limit(n: number) {
    this.max = n
    return this
  }
  single() {
    this.mode = "single"
    return this
  }
  maybeSingle() {
    this.mode = "maybeSingle"
    return this
  }

  private run(): Result {
    if (this.write) return { data: null, error: DEMO_READ_ONLY_ERROR }
    const all = db()
    let rows = (all[this.table] ?? []).filter((r) => this.filters.every((f) => f(r)))
    for (const { column, ascending } of [...this.orders].reverse()) {
      rows = [...rows].sort((a, b) => {
        const x = a[column] as string | number | null
        const y = b[column] as string | number | null
        if (x === y) return 0
        if (x == null) return 1
        if (y == null) return -1
        return (x < y ? -1 : 1) * (ascending ? 1 : -1)
      })
    }
    if (this.max != null) rows = rows.slice(0, this.max)

    const withEmbeds = rows.map((row) => {
      const out: Row = { ...row }
      for (const name of this.embeds) {
        const fk = TO_ONE_FK[name]
        if (fk && fk in row) {
          out[name] = (all[name] ?? []).find((r) => r.id === row[fk]) ?? null
        } else {
          const parentFk = PARENT_FK[this.table]
          out[name] = (all[name] ?? []).filter((r) => r[parentFk] === row.id)
        }
      }
      return out
    })

    if (this.mode === "many") return { data: withEmbeds, error: null }
    if (withEmbeds.length === 0 && this.mode === "single") return { data: null, error: { message: "Aucune ligne", code: "PGRST116" } }
    return { data: withEmbeds[0] ?? null, error: null }
  }

  then<A = Result, B = never>(onFulfilled?: ((v: Result) => A | PromiseLike<A>) | null, onRejected?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.run()).then(onFulfilled, onRejected)
  }
}

// ── Indicateurs (équivalents JS des fonctions SQL dashboard_kpis / weekly_pipeline)

const PROBABILITY: Record<string, number> = { new: 0.1, qualified: 0.25, meeting: 0.5, proposal: 0.7 }

function kpisForRange(from: string, to: string) {
  const { leads, events, automation_events, automations } = db()
  const inRange = (v: unknown) => String(v) >= from && String(v) < to
  const periodLeads = leads.filter((l) => inRange(l.created_at))
  const responded = periodLeads.filter((l) => l.first_response_at)
  const minutesById = new Map(automations.map((a) => [a.id, a.minutes_saved_per_run as number]))
  const saved = automation_events
    .filter((e) => e.status === "success" && inRange(e.occurred_at) && e.automation_id)
    .reduce((s, e) => s + (minutesById.get(String(e.automation_id)) ?? 0), 0)
  return {
    new_leads: periodLeads.length,
    won_leads: periodLeads.filter((l) => l.stage === "won").length,
    signed_revenue_cents: events
      .filter((e) => inRange(e.created_at) && e.status !== "cancelled")
      .reduce((s, e) => s + (e.contract_amount_cents as number), 0),
    avg_first_response_minutes: responded.length
      ? Math.round(
          (responded.reduce((s, l) => s + (Date.parse(String(l.first_response_at)) - Date.parse(String(l.created_at))), 0) /
            responded.length /
            60_000) *
            10,
        ) / 10
      : null,
    hours_saved: Math.round((saved / 60) * 10) / 10,
  }
}

function rpc(name: string, args: Record<string, unknown>): Result {
  const { leads, events } = db()
  if (name === "dashboard_kpis") {
    const from = String(args.p_from)
    const to = String(args.p_to)
    const span = Date.parse(to) - Date.parse(from)
    const open = leads.filter((l) => l.stage !== "won" && l.stage !== "lost")
    return {
      data: {
        current: kpisForRange(from, to),
        previous: kpisForRange(new Date(Date.parse(from) - span).toISOString(), from),
        forecast_revenue_cents: Math.round(open.reduce((s, l) => s + (l.budget_cents as number) * (PROBABILITY[String(l.stage)] ?? 0), 0)),
        open_leads: open.length,
      },
      error: null,
    }
  }
  if (name === "weekly_pipeline") {
    const weeks = Number(args.p_weeks ?? 12)
    const monday = (t: number) => {
      const d = new Date(t)
      d.setUTCHours(0, 0, 0, 0)
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
      return d.toISOString().slice(0, 10)
    }
    const current = Date.parse(monday(Date.now()))
    const data = Array.from({ length: weeks }, (_, i) => {
      const week = new Date(current - (weeks - 1 - i) * 7 * 86_400_000).toISOString().slice(0, 10)
      return {
        week,
        leads: leads.filter((l) => monday(Date.parse(String(l.created_at))) === week).length,
        signed: events.filter((e) => monday(Date.parse(String(e.created_at))) === week).length,
      }
    })
    return { data, error: null }
  }
  return { data: null, error: { message: `Fonction inconnue en mode démo : ${name}`, code: "DEMO" } }
}

const demoUser = { id: DEMO_USER_ID, email: DEMO_USER_EMAIL, user_metadata: { full_name: "Claire Martin" } }
const ok = async <T,>(data: T) => ({ data, error: null })
const refused = async () => ({ data: null, error: DEMO_READ_ONLY_ERROR })

const channel = {
  on() {
    return channel
  },
  subscribe() {
    return channel
  },
}

export function createDemoClient() {
  return {
    from: (table: string) => new DemoQuery(table),
    rpc: (name: string, args: Record<string, unknown> = {}) => Promise.resolve(rpc(name, args)),
    auth: {
      getUser: () => ok({ user: demoUser }),
      getSession: () => ok({ session: null }),
      signInWithPassword: () => ok({ user: demoUser, session: null }),
      signInWithOtp: refused,
      signOut: () => ok(null),
      exchangeCodeForSession: () => ok(null),
      admin: { listUsers: () => ok({ users: [] }), inviteUserByEmail: refused },
    },
    storage: {
      from: () => ({ upload: refused, getPublicUrl: () => ({ data: { publicUrl: "" } }) }),
    },
    channel: () => channel,
    removeChannel: () => Promise.resolve("ok"),
  }
}
