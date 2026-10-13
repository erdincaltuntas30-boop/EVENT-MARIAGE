import type { IngestRepo, Row, Table } from "./repo"
import type {
  AutomationRunInput,
  EventInput,
  IngestType,
  LeadInput,
  LeadStageInput,
  PaymentInput,
  TaskInput,
} from "./schemas"

export type Outcome = "created" | "updated" | "unchanged"

/** Erreur métier renvoyée à n8n avec un code HTTP explicite. */
export class IngestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const SOURCE_LABELS: Record<string, string> = {
  form: "le formulaire",
  instagram: "Instagram",
  mariages_net: "Mariages.net",
  email: "email",
  other: "un autre canal",
}

const STAGE_LABELS: Record<string, string> = {
  new: "Nouveau",
  qualified: "Qualifié",
  meeting: "RDV",
  proposal: "Proposition",
  won: "Signé",
  lost: "Perdu",
}

const toCents = (euros: number | null | undefined) => (euros == null ? euros : Math.round(euros * 100))

/** Retire les clés `undefined` : un champ absent du payload ne remplace jamais une valeur existante. */
function defined(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505"
}

/** Upsert idempotent sur (org_id, external_id). */
async function upsert(
  repo: IngestRepo,
  table: Table,
  orgId: string,
  externalId: string,
  values: Record<string, unknown>,
): Promise<{ row: Row; outcome: Outcome }> {
  const patch = defined(values)
  const existing = await repo.findOne(table, orgId, { external_id: externalId })
  if (existing) {
    await repo.update(table, existing.id, patch)
    return { row: { ...existing, ...patch }, outcome: "updated" }
  }
  try {
    const row = await repo.insert(table, { ...patch, org_id: orgId, external_id: externalId })
    return { row, outcome: "created" }
  } catch (e) {
    // Requête concurrente avec le même external_id : on bascule en mise à jour.
    if (!isUniqueViolation(e)) throw e
    const again = await repo.findOne(table, orgId, { external_id: externalId })
    if (!again) throw e
    await repo.update(table, again.id, patch)
    return { row: { ...again, ...patch }, outcome: "updated" }
  }
}

/** Journalise une activité une seule fois (clé déterministe). */
async function logOnce(repo: IngestRepo, orgId: string, externalId: string, values: Record<string, unknown>) {
  const existing = await repo.findOne("automation_events", orgId, { external_id: externalId })
  if (existing) return existing
  try {
    return await repo.insert("automation_events", { ...defined(values), org_id: orgId, external_id: externalId })
  } catch (e) {
    if (isUniqueViolation(e)) return null
    throw e
  }
}

async function requireByExternalId(repo: IngestRepo, table: Table, orgId: string, externalId: string, label: string) {
  const row = await repo.findOne(table, orgId, { external_id: externalId })
  if (!row) throw new IngestError(`${label} introuvable (external_id « ${externalId} »)`, 422)
  return row
}

async function optionalByExternalId(repo: IngestRepo, table: Table, orgId: string, externalId?: string | null) {
  return externalId ? repo.findOne(table, orgId, { external_id: externalId }) : null
}

// ───────────────────────── Handlers ─────────────────────────

export async function ingestLead(repo: IngestRepo, orgId: string, input: LeadInput): Promise<Outcome> {
  const { row, outcome } = await upsert(repo, "leads", orgId, input.external_id, {
    source: input.source,
    first_name: input.first_name,
    last_name: input.last_name,
    partner_name: input.partner_name,
    email: input.email,
    phone: input.phone,
    wedding_date: input.wedding_date,
    budget_cents: toCents(input.budget),
    guest_count: input.guest_count,
    venue: input.venue,
    notes: input.message,
    stage: input.stage,
    created_at: input.created_at,
  })
  if (outcome === "created") {
    const name = [input.first_name, input.last_name].filter(Boolean).join(" ")
    await logOnce(repo, orgId, `lead.received:${input.external_id}`, {
      type: "lead.received",
      status: "info",
      actor: "system",
      lead_id: row.id,
      title: `Nouvelle demande de ${name} via ${SOURCE_LABELS[input.source]}`,
      detail: { source: input.source },
      occurred_at: input.created_at,
    })
  }
  return outcome
}

export async function ingestLeadStage(repo: IngestRepo, orgId: string, input: LeadStageInput): Promise<Outcome> {
  const lead = await requireByExternalId(repo, "leads", orgId, input.lead_external_id, "Lead")
  const logged = await repo.findOne("automation_events", orgId, { external_id: input.external_id })
  if (logged) return "unchanged"
  await repo.update("leads", lead.id, defined({ stage: input.stage, lost_reason: input.stage === "lost" ? input.reason : undefined }))
  await logOnce(repo, orgId, input.external_id, {
    type: "lead.stage_changed",
    status: "info",
    actor: "automation",
    lead_id: lead.id,
    title: `Étape « ${STAGE_LABELS[input.stage]} »`,
    detail: { from: lead.stage, to: input.stage, reason: input.reason },
    occurred_at: input.occurred_at,
  })
  return "updated"
}

export async function ingestEvent(repo: IngestRepo, orgId: string, input: EventInput): Promise<Outcome> {
  const lead = await optionalByExternalId(repo, "leads", orgId, input.lead_external_id)
  const { row, outcome } = await upsert(repo, "events", orgId, input.external_id, {
    lead_id: lead?.id,
    title: input.title,
    couple_names: input.couple_names,
    date: input.date,
    venue: input.venue,
    guest_count: input.guest_count,
    contract_amount_cents: toCents(input.contract_amount),
    status: input.status,
  })
  if (outcome === "created") {
    if (lead && lead.stage !== "won") await repo.update("leads", lead.id, { stage: "won" })
    await logOnce(repo, orgId, `event.signed:${input.external_id}`, {
      type: "event.signed",
      status: "success",
      actor: "system",
      lead_id: lead?.id,
      event_id: row.id,
      title: `Mariage signé : ${input.title}`,
      detail: { contract_amount: input.contract_amount },
    })
  }
  return outcome
}

export async function ingestPayment(repo: IngestRepo, orgId: string, input: PaymentInput): Promise<Outcome> {
  const event = await requireByExternalId(repo, "events", orgId, input.event_external_id, "Mariage")
  const { outcome } = await upsert(repo, "payments", orgId, input.external_id, {
    event_id: event.id,
    label: input.label,
    amount_cents: toCents(input.amount),
    due_date: input.due_date,
    status: input.status,
    received_at: input.received_at ?? (input.status === "received" ? new Date().toISOString() : undefined),
  })
  return outcome
}

export async function ingestTask(repo: IngestRepo, orgId: string, input: TaskInput): Promise<Outcome> {
  const event = await requireByExternalId(repo, "events", orgId, input.event_external_id, "Mariage")
  const existing = await repo.findOne("event_tasks", orgId, { external_id: input.external_id })
  const { outcome } = await upsert(repo, "event_tasks", orgId, input.external_id, {
    event_id: event.id,
    title: input.title,
    milestone: input.milestone,
    due_date: input.due_date,
    // On ne réécrit pas la date de complétion d'une tâche déjà terminée.
    done_at: input.done ? (existing?.done_at ?? new Date().toISOString()) : null,
  })
  return outcome
}

export async function ingestAutomationRun(
  repo: IngestRepo,
  orgId: string,
  input: AutomationRunInput,
): Promise<Outcome> {
  let automation = await repo.findOne("automations", orgId, { key: input.automation_key })
  if (!automation) {
    // Automatisation inconnue : on la crée en pause pour qu'elle apparaisse dans le catalogue.
    automation = await repo.insert("automations", {
      org_id: orgId,
      key: input.automation_key,
      name: input.automation_key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
      description: "Détectée automatiquement depuis n8n.",
      category: "other",
      is_enabled: false,
    })
  }
  if (input.respect_pause && automation.is_enabled === false) {
    throw new IngestError("Automatisation en pause", 409)
  }

  const [lead, event] = await Promise.all([
    optionalByExternalId(repo, "leads", orgId, input.lead_external_id),
    optionalByExternalId(repo, "events", orgId, input.event_external_id),
  ])

  const values = {
    automation_id: automation.id,
    type: "automation.run",
    status: input.status,
    actor: "automation",
    lead_id: lead?.id,
    event_id: event?.id,
    title: input.title,
    detail: { ...input.detail, n8n_execution: input.external_id },
    error_message: input.status === "error" ? (input.error_message ?? "Erreur non précisée") : null,
    occurred_at: input.occurred_at ?? new Date().toISOString(),
  }

  let outcome: Outcome
  const pending = input.request_id
    ? await repo.findOne("automation_events", orgId, { external_id: input.request_id })
    : null
  if (pending) {
    // Réponse à une action déclenchée depuis l'app : on complète la ligne « en cours ».
    await repo.update("automation_events", pending.id, defined({ ...values, actor: undefined, lead_id: values.lead_id ?? undefined }))
    outcome = "updated"
  } else {
    outcome = (await upsert(repo, "automation_events", orgId, input.external_id, values)).outcome
  }

  if (input.first_response && input.status === "success" && lead && !lead.first_response_at) {
    await repo.update("leads", lead.id, { first_response_at: values.occurred_at })
  }
  return outcome
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const HANDLERS: Record<IngestType, (repo: IngestRepo, orgId: string, input: any) => Promise<Outcome>> = {
  lead: ingestLead,
  "lead-stage": ingestLeadStage,
  event: ingestEvent,
  payment: ingestPayment,
  task: ingestTask,
  "automation-run": ingestAutomationRun,
}
