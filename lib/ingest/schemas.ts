import { z } from "zod"

const externalId = z.string().trim().min(1).max(200)
const optionalText = z.string().trim().max(2000).nullish()
const isoDate = z.iso.date()
const isoDateTime = z.iso.datetime({ offset: true })
/** Montants reçus en euros (ex. 25000 ou 25000.5), stockés en centimes. */
const euros = z.number().nonnegative().max(10_000_000)

export const leadSchema = z.object({
  external_id: externalId,
  source: z.enum(["form", "instagram", "mariages_net", "email", "other"]).default("other"),
  first_name: z.string().trim().min(1).max(120),
  last_name: optionalText,
  partner_name: optionalText,
  email: z.email().nullish(),
  phone: z.string().trim().max(40).nullish(),
  wedding_date: isoDate.nullish(),
  budget: euros.nullish(),
  guest_count: z.number().int().nonnegative().max(5000).nullish(),
  venue: optionalText,
  message: optionalText,
  stage: z.enum(["new", "qualified", "meeting", "proposal", "won", "lost"]).optional(),
  created_at: isoDateTime.optional(),
})

export const leadStageSchema = z.object({
  external_id: externalId,
  lead_external_id: externalId,
  stage: z.enum(["new", "qualified", "meeting", "proposal", "won", "lost"]),
  reason: optionalText,
  occurred_at: isoDateTime.optional(),
})

export const eventSchema = z.object({
  external_id: externalId,
  lead_external_id: externalId.nullish(),
  title: z.string().trim().min(1).max(200),
  couple_names: optionalText,
  date: isoDate,
  venue: optionalText,
  guest_count: z.number().int().nonnegative().max(5000).nullish(),
  contract_amount: euros.default(0),
  status: z.enum(["planned", "done", "cancelled"]).default("planned"),
})

export const paymentSchema = z.object({
  external_id: externalId,
  event_external_id: externalId,
  label: z.string().trim().min(1).max(200),
  amount: euros,
  due_date: isoDate.nullish(),
  status: z.enum(["pending", "received", "overdue"]).default("pending"),
  received_at: isoDateTime.nullish(),
})

export const taskSchema = z.object({
  external_id: externalId,
  event_external_id: externalId,
  title: z.string().trim().min(1).max(200),
  milestone: z.enum(["J-90", "J-30", "J-7", "J-1", "custom"]).default("custom"),
  due_date: isoDate.nullish(),
  done: z.boolean().default(false),
})

export const automationRunSchema = z.object({
  external_id: externalId,
  /** Renvoyé par n8n quand l'exécution répond à une action déclenchée depuis l'app. */
  request_id: externalId.nullish(),
  automation_key: z.string().trim().regex(/^[a-z0-9_]{2,80}$/, "slug en minuscules (a-z, 0-9, _)"),
  status: z.enum(["success", "error", "info"]),
  title: z.string().trim().min(1).max(300),
  lead_external_id: externalId.nullish(),
  event_external_id: externalId.nullish(),
  detail: z.record(z.string(), z.unknown()).default({}),
  error_message: optionalText,
  first_response: z.boolean().default(false),
  respect_pause: z.boolean().default(false),
  occurred_at: isoDateTime.optional(),
})

export const INGEST_SCHEMAS = {
  lead: leadSchema,
  "lead-stage": leadStageSchema,
  event: eventSchema,
  payment: paymentSchema,
  task: taskSchema,
  "automation-run": automationRunSchema,
} as const

export type IngestType = keyof typeof INGEST_SCHEMAS
export const INGEST_TYPES = Object.keys(INGEST_SCHEMAS) as IngestType[]
export const MAX_BATCH = 100

export function isIngestType(value: string): value is IngestType {
  return value in INGEST_SCHEMAS
}

/** Accepte un objet seul ou `{ items: [...] }`. */
export function extractItems(body: unknown): unknown[] | null {
  if (body && typeof body === "object" && !Array.isArray(body) && "items" in body) {
    const items = (body as { items: unknown }).items
    return Array.isArray(items) ? items : null
  }
  return body && typeof body === "object" && !Array.isArray(body) ? [body] : null
}

export type LeadInput = z.infer<typeof leadSchema>
export type LeadStageInput = z.infer<typeof leadStageSchema>
export type EventInput = z.infer<typeof eventSchema>
export type PaymentInput = z.infer<typeof paymentSchema>
export type TaskInput = z.infer<typeof taskSchema>
export type AutomationRunInput = z.infer<typeof automationRunSchema>
