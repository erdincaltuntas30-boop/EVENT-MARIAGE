/**
 * Données fictives du mode démo (agence « Maison Lumière »), générées de façon déterministe.
 * Même contenu côté serveur et navigateur : aucune dépendance lourde (pas de faker).
 */
import { DEFAULT_AUTOMATIONS } from "@/lib/automations/catalog"

export const DEMO_ORG_ID = "demo-org"
export const DEMO_USER_ID = "demo-user"
export const DEMO_USER_EMAIL = "demo@event-mariage.app"

type Row = Record<string, unknown> & { id: string }
export type DemoTables = Record<string, Row[]>

const FIRST = ["Camille", "Léa", "Chloé", "Manon", "Inès", "Sarah", "Emma", "Jade", "Louise", "Alice", "Clara", "Julie", "Lucas", "Hugo", "Thomas", "Nathan", "Louis", "Arthur", "Jules", "Paul", "Mathis", "Gabriel", "Adam", "Victor"]
const LAST = ["Martin", "Bernard", "Dubois", "Durand", "Lefèvre", "Moreau", "Laurent", "Simon", "Michel", "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier", "Morel", "Girard", "André", "Mercier", "Blanc", "Guérin", "Boyer", "Fontaine", "Chevalier"]
const VENUES = ["Château de la Durantie", "Domaine des Évis", "Abbaye de Royaumont", "Mas de la Rose", "Orangerie du Château de Sceaux", "Bastide de Gordes", "Domaine de Primard", "Manoir de la Prairie", "Moulin de Boissy", "Château de Vallery", "Ferme de Bouchemont"]
const VENDORS: [string, string][] = [
  ["Maison Gourmet Traiteur", "Traiteur"],
  ["Atelier Lumière Photo", "Photographe"],
  ["Pétales & Co", "Fleuriste"],
  ["DJ Sacha Events", "DJ"],
  ["Les Douceurs de Margaux", "Pâtissier"],
  ["Studio Cinéma Nuptial", "Vidéaste"],
  ["Beauté Bohème", "Coiffure & maquillage"],
  ["Location Belle Table", "Location de mobilier"],
  ["Quatuor Opaline", "Musiciens"],
  ["Officiante Laïque Hélène", "Officiante"],
]
const TASKS: [string, string, number][] = [
  ["Valider le menu et la dégustation", "J-90", 95],
  ["Envoyer les faire-part", "J-90", 90],
  ["Réserver le transport des invités", "J-90", 85],
  ["Confirmer le nombre d'invités", "J-30", 32],
  ["Finaliser le plan de table", "J-30", 28],
  ["Valider le déroulé avec le lieu", "J-30", 25],
  ["Envoyer le déroulé final aux prestataires", "J-7", 7],
  ["Récupérer le solde des acomptes", "J-7", 7],
  ["Préparer le kit jour J", "J-1", 1],
  ["Briefing final avec l'équipe", "J-1", 1],
]
const ERRORS = [
  "L'adresse email du destinataire est invalide.",
  "Mariages.net n'a pas répondu à temps.",
  "Le modèle d'email « Relance J+3 » est introuvable.",
  "Quota d'envoi de SMS atteint pour aujourd'hui.",
  "L'agenda Google de l'agence n'est plus connecté.",
]
const SOURCES = ["form", "form", "form", "instagram", "instagram", "mariages_net", "mariages_net", "email", "other"]
const STAGES: [string, number][] = [["new", 7], ["qualified", 6], ["meeting", 5], ["proposal", 6], ["won", 12], ["lost", 4]]

const DAY = 86_400_000
const iso = (t: number) => new Date(t).toISOString()
const day = (t: number) => iso(t).slice(0, 10)

export function buildDemoData(): DemoTables {
  // Générateur pseudo-aléatoire à graine fixe (mulberry32)
  let seed = 2026
  const rand = () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)]
  const chance = (p: number) => rand() < p

  // Arrondi à l'heure : serveur et navigateur produisent les mêmes dates.
  const NOW = Math.floor(Date.now() / 3_600_000) * 3_600_000
  const today = day(NOW)
  const org = DEMO_ORG_ID

  const automations: Row[] = DEFAULT_AUTOMATIONS.map((a, i) => ({
    id: `auto-${i + 1}`,
    org_id: org,
    is_enabled: a.key !== "vendor_confirmation",
    created_at: iso(NOW - 200 * DAY + i * 1000),
    ...a,
  }))
  const auto = Object.fromEntries(automations.map((a) => [a.key as string, a.id]))

  // ── Leads
  const leads: Row[] = []
  for (const [stage, count] of STAGES) {
    for (let i = 0; i < count; i++) {
      const n = leads.length + 1
      const age = stage === "new" ? int(0, 6) : stage === "won" ? int(10, 170) : int(5, 90)
      const created = Math.min(NOW - 30 * 60_000, NOW - age * DAY + int(8, 20) * 3_600_000 - 12 * 3_600_000)
      const first = pick(FIRST)
      const last = pick(LAST)
      const noReply = stage === "new" && i < 2
      leads.push({
        id: `lead-${n}`,
        org_id: org,
        external_id: `demo-lead-${n}`,
        first_name: first,
        last_name: last,
        partner_name: pick(FIRST),
        email: `${first}.${last}`.toLowerCase().normalize("NFD").replace(/[^a-z.]/g, "") + "@exemple.fr",
        phone: `06 ${int(10, 99)} ${int(10, 99)} ${int(10, 99)} ${int(10, 99)}`,
        source: pick(SOURCES),
        stage,
        wedding_date: day(NOW + int(stage === "won" ? -60 : 60, 420) * DAY),
        budget_cents: int(12, 65) * 100_000,
        guest_count: int(6, 30) * 10,
        venue: pick(VENUES),
        notes: chance(0.3) ? pick(["Souhaite une cérémonie laïque en extérieur.", "Très sensible au style bohème.", "Attention : allergie aux fruits à coque chez la mariée."]) : null,
        first_response_at: noReply ? null : iso(created + int(1, 14) * 60_000),
        lost_reason: stage === "lost" ? pick(["Budget trop serré", "A choisi une autre agence", "Projet reporté"]) : null,
        stage_changed_at: iso(created),
        created_at: iso(created),
        updated_at: iso(created),
      })
    }
  }

  // ── Mariages signés (3 passés, 9 à venir)
  const won = leads.filter((l) => l.stage === "won")
  const events: Row[] = won.map((l, i) => {
    const date = i < 3 ? NOW - int(5, 45) * DAY : NOW + int(8, 320) * DAY
    const signed = Math.min(NOW - 2 * DAY, Date.parse(String(l.created_at)) + int(6, 25) * DAY)
    l.wedding_date = day(date)
    return {
      id: `event-${i + 1}`,
      org_id: org,
      external_id: `demo-event-${i + 1}`,
      lead_id: l.id,
      title: `Mariage ${l.first_name} & ${l.partner_name}`,
      couple_names: `${l.first_name} & ${l.partner_name}`,
      date: day(date),
      venue: l.venue,
      guest_count: l.guest_count,
      contract_amount_cents: Math.round(((l.budget_cents as number) * (0.85 + rand() * 0.2)) / 10_000) * 10_000,
      status: i < 3 ? "done" : "planned",
      created_at: iso(signed),
    }
  })

  const vendors: Row[] = VENDORS.map(([name, category], i) => ({
    id: `vendor-${i + 1}`,
    org_id: org,
    name,
    category,
    email: `contact@${name.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}.fr`,
    phone: null,
  }))

  const event_tasks: Row[] = []
  const event_vendors: Row[] = []
  const payments: Row[] = []
  for (const e of events) {
    const date = Date.parse(`${e.date}T12:00:00Z`)
    TASKS.forEach(([title, milestone, before], i) => {
      const due = day(date - before * DAY)
      event_tasks.push({
        id: `${e.id}-task-${i + 1}`,
        org_id: org,
        event_id: e.id,
        title,
        milestone,
        due_date: due,
        done_at: due < today && chance(0.9) ? iso(date - (before + 1) * DAY) : null,
      })
    })
    const count = int(4, 6)
    const start = int(0, vendors.length - 1)
    for (let k = 0; k < count; k++) {
      const v = vendors[(start + k) % vendors.length]
      event_vendors.push({
        id: `${e.id}-${v.id}`,
        org_id: org,
        event_id: e.id,
        vendor_id: v.id,
        role: v.category,
        amount_cents: int(8, 90) * 10_000,
      })
    }
    const total = e.contract_amount_cents as number
    const plan: [string, number, number][] = [
      ["Acompte 30 %", 0.3, Date.parse(String(e.created_at))],
      ["Deuxième acompte 40 %", 0.4, date - 60 * DAY],
      ["Solde 30 %", 0.3, date - 7 * DAY],
    ]
    plan.forEach(([label, share, due], i) => {
      const dueDay = day(due)
      const received = i === 0 || (dueDay < today && chance(0.8))
      payments.push({
        id: `${e.id}-pay-${i + 1}`,
        org_id: org,
        event_id: e.id,
        external_id: `${e.external_id}-pay-${i + 1}`,
        label,
        amount_cents: Math.round(total * share),
        due_date: dueDay,
        status: received ? "received" : dueDay < today ? "overdue" : "pending",
        received_at: received ? iso(due + int(0, 3) * DAY) : null,
      })
    })
  }

  // ── 300 événements d'automatisation
  const activity: Row[] = []
  const name = (l: Row) => `${l.first_name} ${l.last_name}`
  const push = (row: Omit<Row, "id">) =>
    activity.push({
      id: `act-${activity.length + 1}`,
      org_id: org,
      external_id: `demo-act-${activity.length + 1}`,
      automation_id: null,
      actor: "automation",
      actor_user_id: null,
      lead_id: null,
      event_id: null,
      detail: {},
      error_message: null,
      ...row,
    })
  const run = (key: string, at: number, title: string, ref: { lead?: Row; eventId?: string }, forceOk = false) => {
    const failed = !forceOk && chance(0.08)
    push({
      automation_id: auto[key],
      type: "automation.run",
      status: failed ? "error" : "success",
      lead_id: ref.lead?.id ?? null,
      event_id: ref.eventId ?? null,
      title: failed ? `Échec — ${title}` : title,
      error_message: failed ? pick(ERRORS) : null,
      detail: { channel: pick(["email", "email", "sms"]) },
      occurred_at: iso(Math.min(at, NOW - 60_000)),
    })
  }

  for (const l of leads) {
    const created = Date.parse(String(l.created_at))
    push({ type: "lead.received", status: "info", actor: "system", lead_id: l.id, title: `Nouvelle demande de ${name(l)}`, occurred_at: l.created_at })
    if (l.first_response_at) run("lead_instant_reply", Date.parse(String(l.first_response_at)), `Réponse envoyée à ${name(l)}`, { lead: l }, true)
    run("lead_qualification", created + 3 * 60_000, `${name(l)} qualifié·e (budget ${Math.round((l.budget_cents as number) / 100_000)} k€)`, { lead: l })
    if (["meeting", "proposal", "won", "lost"].includes(String(l.stage))) run("meeting_reminder", created + 4 * DAY, `Rappel de rendez-vous envoyé à ${name(l)}`, { lead: l })
    if (["proposal", "won", "lost"].includes(String(l.stage))) run("proposal_follow_up_j3", created + 9 * DAY, `Relance J+3 envoyée à ${name(l)}`, { lead: l })
  }
  for (const e of events) {
    const lead = leads.find((l) => l.id === e.lead_id)!
    push({ type: "event.signed", status: "success", actor: "system", lead_id: lead.id, event_id: e.id, title: `Mariage signé : ${e.title}`, occurred_at: e.created_at })
    const date = Date.parse(`${e.date}T10:00:00Z`)
    for (const before of [90, 30, 7]) {
      if (date - before * DAY < NOW) run("checklist_milestones", date - before * DAY, `Checklist J-${before} préparée pour ${e.couple_names}`, { lead, eventId: e.id })
    }
    if (date - 7 * DAY < NOW) run("vendor_confirmation", date - 7 * DAY, `Déroulé envoyé aux prestataires de ${e.couple_names}`, { lead, eventId: e.id })
    if (e.status === "done") run("review_request", date + 2 * DAY, `Demande d'avis envoyée à ${e.couple_names}`, { lead, eventId: e.id })
  }
  for (const p of payments.filter((p) => p.status === "overdue")) {
    const e = events.find((x) => x.id === p.event_id)!
    run("deposit_reminder", Date.parse(`${p.due_date}T09:00:00Z`) + DAY, `Rappel d'acompte envoyé à ${e.couple_names}`, { eventId: e.id })
  }
  for (const l of leads.filter((x) => x.stage === "proposal").slice(0, 3)) {
    push({ type: "lead.follow_up", status: "success", actor: "user", actor_user_id: DEMO_USER_ID, lead_id: l.id, title: `Relance demandée pour ${name(l)}`, occurred_at: iso(NOW - int(0, 4) * DAY - 3_600_000) })
  }
  while (activity.length < 300) {
    const l = pick(leads)
    // Toujours après la réception de la demande
    const created = Date.parse(String(l.created_at))
    const from = Math.max(created, NOW - 30 * DAY)
    run(pick(["lead_qualification", "meeting_reminder", "proposal_follow_up_j3"]), from + rand() * (NOW - from), `Suivi automatique pour ${name(l)}`, { lead: l })
  }
  activity.length = 300

  // ── Statistiques par automatisation (équivalent de la vue automation_stats)
  const automation_stats: Row[] = automations.map((a) => {
    const runs = activity
      .filter((e) => e.automation_id === a.id && (e.status === "success" || e.status === "error"))
      .sort((x, y) => String(y.occurred_at).localeCompare(String(x.occurred_at)))
    return {
      id: a.id,
      automation_id: a.id,
      org_id: org,
      runs_total: runs.length,
      runs_success: runs.filter((e) => e.status === "success").length,
      runs_error: runs.filter((e) => e.status === "error").length,
      runs_30d: runs.filter((e) => Date.parse(String(e.occurred_at)) > NOW - 30 * DAY).length,
      last_run_at: runs[0]?.occurred_at ?? null,
      last_status: runs[0]?.status ?? null,
    }
  })

  return {
    organizations: [
      { id: org, name: "Maison Lumière", slug: "maison-lumiere", logo_url: null, accent_color: "#4F6B5A", locale: "fr", timezone: "Europe/Paris", created_at: iso(NOW - 200 * DAY) },
    ],
    profiles: [{ id: DEMO_USER_ID, full_name: "Claire Martin", email: DEMO_USER_EMAIL }],
    memberships: [{ id: "m-1", org_id: org, user_id: DEMO_USER_ID, role: "admin", created_at: iso(NOW - 200 * DAY) }],
    leads,
    events,
    event_tasks,
    vendors,
    event_vendors,
    payments,
    automations,
    automation_events: activity,
    automation_stats,
    api_keys: [],
    org_webhooks: [],
  }
}
