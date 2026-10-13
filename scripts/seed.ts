/**
 * Données de démonstration : agence « Maison Lumière » (40 leads, 12 mariages, 300 événements d'automatisation)
 * + une agence témoin pour vérifier l'isolation RLS.
 *
 *   npm run seed
 *
 * Idempotent : les deux agences de démo sont supprimées puis recréées à chaque exécution.
 */
import { fakerFR as faker } from "@faker-js/faker"
import { createClient } from "@supabase/supabase-js"
import { addDays, addMinutes, subDays } from "date-fns"
import { encrypt, generateApiKey } from "../lib/crypto"
import { provisionOrganization } from "../lib/provision"

faker.seed(2026)

const env = (name: string, fallback?: string) => {
  const v = process.env[name] ?? fallback
  if (!v) throw new Error(`Variable d'environnement manquante : ${name} (voir .env.example)`)
  return v
}

const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
})
const ENCRYPTION_KEY = env("APP_ENCRYPTION_KEY")
const DEMO_EMAIL = env("DEMO_USER_EMAIL")
const DEMO_PASSWORD = env("DEMO_USER_PASSWORD")
const WITNESS_EMAIL = env("DEMO_WITNESS_EMAIL", "temoin@event-mariage.test")

const NOW = new Date()
const iso = (d: Date) => d.toISOString()
const day = (d: Date) => d.toISOString().slice(0, 10)
const pick = <T,>(arr: readonly T[]) => faker.helpers.arrayElement(arr)
const chance = (p: number) => faker.number.float({ min: 0, max: 1 }) < p

async function must<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p
  if (error) throw error
  return data
}

async function insertBatches(table: string, rows: Record<string, unknown>[], size = 100) {
  for (let i = 0; i < rows.length; i += size) await must(db.from(table).insert(rows.slice(i, i + size)))
}

async function ensureUser(email: string, fullName: string) {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 })
  const existing = data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (existing) {
    await db.auth.admin.updateUserById(existing.id, { password: DEMO_PASSWORD, user_metadata: { full_name: fullName } })
    await db.from("profiles").upsert({ id: existing.id, email, full_name: fullName })
    return existing.id
  }
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error) throw error
  return created.user.id
}

async function resetOrg(slug: string) {
  await db.from("organizations").delete().eq("slug", slug)
}

// ───────────────────────── Données de référence ─────────────────────────

const VENUES = [
  "Château de la Durantie",
  "Domaine des Évis",
  "Abbaye de Royaumont",
  "Mas de la Rose",
  "Orangerie du Château de Sceaux",
  "Bastide de Gordes",
  "Domaine de Primard",
  "Manoir de la Prairie",
  "Villa Ephrussi de Rothschild",
  "Moulin de Boissy",
  "Château de Vallery",
  "Ferme de Bouchemont",
]

const VENDORS = [
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
] as const

const TASKS: [string, "J-90" | "J-30" | "J-7" | "J-1", number][] = [
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

const SOURCES = ["form", "instagram", "mariages_net", "email", "other"] as const
const SOURCE_WEIGHTS = [
  { value: "form", weight: 35 },
  { value: "instagram", weight: 25 },
  { value: "mariages_net", weight: 25 },
  { value: "email", weight: 12 },
  { value: "other", weight: 3 },
] as const

const STAGE_PLAN: [string, number][] = [
  ["new", 7],
  ["qualified", 6],
  ["meeting", 5],
  ["proposal", 6],
  ["won", 12],
  ["lost", 4],
]

// ───────────────────────── Script ─────────────────────────

type LeadRow = {
  id: string
  external_id: string
  first_name: string
  last_name: string
  partner_name: string
  email: string
  stage: string
  created_at: string
  first_response_at: string | null
  budget_cents: number
  guest_count: number
  wedding_date: string
  venue: string
}

async function seedMaisonLumiere(ownerId: string) {
  await resetOrg("maison-lumiere")
  const org = await provisionOrganization(db, {
    name: "Maison Lumière",
    slug: "maison-lumiere",
    ownerId,
    encryptionKey: ENCRYPTION_KEY,
    accentColor: "#4F6B5A",
  })
  const automations = await must(db.from("automations").select("id, key").eq("org_id", org.id))
  const auto = Object.fromEntries((automations as { id: string; key: string }[]).map((a) => [a.key, a.id]))

  // Leads
  const leadInputs: Omit<LeadRow, "id">[] = []
  let n = 0
  for (const [stage, count] of STAGE_PLAN) {
    for (let i = 0; i < count; i++) {
      n++
      // Les leads récents sont en début de pipeline, les signés plus anciens.
      const ageDays =
        stage === "new"
          ? faker.number.int({ min: 0, max: 6 })
          : stage === "won"
            ? faker.number.int({ min: 35, max: 170 })
            : faker.number.int({ min: 5, max: 90 })
      const created = subDays(NOW, ageDays)
      created.setHours(faker.number.int({ min: 8, max: 22 }), faker.number.int({ min: 0, max: 59 }))
      if (created > NOW) created.setTime(NOW.getTime() - 30 * 60_000)
      const noReply = stage === "new" && i < 2
      const firstName = faker.person.firstName()
      const lastName = faker.person.lastName()
      leadInputs.push({
        external_id: `demo-lead-${n}`,
        first_name: firstName,
        last_name: lastName,
        partner_name: faker.person.firstName(),
        email: faker.internet.email({ firstName, lastName, provider: "exemple.fr" }).toLowerCase(),
        stage,
        created_at: iso(created),
        first_response_at: noReply ? null : iso(addMinutes(created, faker.number.int({ min: 1, max: 14 }))),
        budget_cents: faker.number.int({ min: 12, max: 65 }) * 1000 * 100,
        guest_count: faker.number.int({ min: 6, max: 30 }) * 10,
        wedding_date: day(addDays(NOW, faker.number.int({ min: stage === "won" ? -60 : 60, max: 420 }))),
        venue: pick(VENUES),
      })
    }
  }
  const leads = (await must(
    db
      .from("leads")
      .insert(
        leadInputs.map((l) => ({
          ...l,
          org_id: org.id,
          source: faker.helpers.weightedArrayElement(SOURCE_WEIGHTS as unknown as { value: string; weight: number }[]),
          phone: faker.phone.number({ style: "national" }),
          stage_changed_at: l.created_at,
          lost_reason: l.stage === "lost" ? pick(["Budget trop serré", "A choisi une autre agence", "Projet reporté"]) : null,
          notes: chance(0.3) ? pick(["Souhaite une cérémonie laïque en extérieur.", "Très sensible au style bohème.", "Attention : allergies (fruits à coque) chez la mariée."]) : null,
        })),
      )
      .select("*"),
  )) as LeadRow[]

  // Mariages signés (12 leads « won »), dont 3 déjà passés
  const won = leads.filter((l) => l.stage === "won").slice(0, 12)
  const eventInputs = won.map((l, i) => {
    const date = i < 3 ? subDays(NOW, faker.number.int({ min: 5, max: 45 })) : addDays(NOW, faker.number.int({ min: 8, max: 320 }))
    const signedAt = addDays(new Date(l.created_at), faker.number.int({ min: 6, max: 25 }))
    return {
      org_id: org.id,
      external_id: `demo-event-${i + 1}`,
      lead_id: l.id,
      title: `Mariage ${l.first_name} & ${l.partner_name}`,
      couple_names: `${l.first_name} & ${l.partner_name}`,
      date: day(date),
      venue: l.venue,
      guest_count: l.guest_count,
      contract_amount_cents: Math.round((l.budget_cents * faker.number.float({ min: 0.85, max: 1.05 })) / 10000) * 10000,
      status: i < 3 ? "done" : "planned",
      created_at: iso(signedAt > NOW ? subDays(NOW, 2) : signedAt),
    }
  })
  const events = (await must(db.from("events").insert(eventInputs).select("*"))) as (typeof eventInputs[number] & { id: string })[]
  for (const e of events) await must(db.from("leads").update({ wedding_date: e.date }).eq("id", e.lead_id))

  // Prestataires
  const vendors = (await must(
    db
      .from("vendors")
      .insert(VENDORS.map(([name, category]) => ({ org_id: org.id, name, category, email: `contact@${name.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}.fr` })))
      .select("id, category"),
  )) as { id: string; category: string }[]

  const today = day(NOW)
  const tasks: Record<string, unknown>[] = []
  const payments: Record<string, unknown>[] = []
  const eventVendors: Record<string, unknown>[] = []

  for (const e of events) {
    const date = new Date(`${e.date}T12:00:00`)
    for (const [title, milestone, before] of TASKS) {
      const due = day(subDays(date, before))
      const isPast = due < today
      tasks.push({
        org_id: org.id,
        event_id: e.id,
        title,
        milestone,
        due_date: due,
        done_at: isPast && chance(0.9) ? iso(subDays(date, before + 1)) : null,
      })
    }
    for (const v of faker.helpers.arrayElements(vendors, { min: 4, max: 6 })) {
      eventVendors.push({
        org_id: org.id,
        event_id: e.id,
        vendor_id: v.id,
        role: v.category,
        amount_cents: faker.number.int({ min: 8, max: 90 }) * 100 * 100,
      })
    }
    const total = e.contract_amount_cents
    const plan: [string, number, Date][] = [
      ["Acompte 30 %", 0.3, new Date(e.created_at)],
      ["Deuxième acompte 40 %", 0.4, subDays(date, 60)],
      ["Solde 30 %", 0.3, subDays(date, 7)],
    ]
    plan.forEach(([label, share, due], i) => {
      const dueDay = day(due)
      const received = i === 0 || (dueDay < today && chance(0.8))
      payments.push({
        org_id: org.id,
        event_id: e.id,
        external_id: `${e.external_id}-pay-${i + 1}`,
        label,
        amount_cents: Math.round(total * share),
        due_date: dueDay,
        status: received ? "received" : dueDay < today ? "overdue" : "pending",
        received_at: received ? iso(addDays(due, faker.number.int({ min: 0, max: 3 }))) : null,
      })
    })
  }
  await insertBatches("event_tasks", tasks)
  await insertBatches("event_vendors", eventVendors)
  await insertBatches("payments", payments)

  // ───────── 300 événements d'automatisation ─────────
  const activity: Record<string, unknown>[] = []
  const name = (l: LeadRow) => `${l.first_name} ${l.last_name}`
  const run = (key: string, at: Date, title: string, ref: { lead?: LeadRow; eventId?: string }, forceSuccess = false) => {
    const failed = !forceSuccess && chance(0.08)
    activity.push({
      org_id: org.id,
      external_id: `demo-run-${activity.length + 1}`,
      automation_id: auto[key],
      type: "automation.run",
      status: failed ? "error" : "success",
      actor: "automation",
      lead_id: ref.lead?.id ?? null,
      event_id: ref.eventId ?? null,
      title: failed ? `Échec : ${title.charAt(0).toLowerCase()}${title.slice(1)}` : title,
      error_message: failed ? pick(ERRORS) : null,
      detail: { channel: pick(["email", "email", "sms"]) },
      occurred_at: iso(at),
    })
  }

  for (const l of leads) {
    const created = new Date(l.created_at)
    activity.push({
      org_id: org.id,
      external_id: `lead.received:${l.external_id}`,
      type: "lead.received",
      status: "info",
      actor: "system",
      lead_id: l.id,
      title: `Nouvelle demande de ${name(l)}`,
      occurred_at: l.created_at,
    })
    if (l.first_response_at) run("lead_instant_reply", new Date(l.first_response_at), `Réponse envoyée à ${name(l)}`, { lead: l }, true)
    run("lead_qualification", addMinutes(created, 3), `${name(l)} qualifié·e (budget ${Math.round(l.budget_cents / 100_000)} k€)`, { lead: l })
    if (["meeting", "proposal", "won", "lost"].includes(l.stage)) {
      run("meeting_reminder", addDays(created, 4), `Rappel de rendez-vous envoyé à ${name(l)}`, { lead: l })
    }
    if (["proposal", "won", "lost"].includes(l.stage)) {
      run("proposal_follow_up_j3", addDays(created, 9), `Relance J+3 envoyée à ${name(l)}`, { lead: l })
    }
  }
  for (const e of events) {
    const lead = leads.find((l) => l.id === e.lead_id)!
    activity.push({
      org_id: org.id,
      external_id: `event.signed:${e.external_id}`,
      type: "event.signed",
      status: "success",
      actor: "system",
      lead_id: lead.id,
      event_id: e.id,
      title: `Mariage signé : ${e.title}`,
      occurred_at: e.created_at,
    })
    const date = new Date(`${e.date}T10:00:00`)
    for (const before of [90, 30, 7]) {
      const at = subDays(date, before)
      if (at < NOW) run("checklist_milestones", at, `Checklist J-${before} préparée pour ${e.couple_names}`, { lead, eventId: e.id })
    }
    if (subDays(date, 7) < NOW) run("vendor_confirmation", subDays(date, 7), `Déroulé envoyé aux prestataires de ${e.couple_names}`, { lead, eventId: e.id })
    if (e.status === "done") run("review_request", addDays(date, 2), `Demande d'avis envoyée à ${e.couple_names}`, { lead, eventId: e.id })
  }
  for (const p of payments.filter((p) => p.status === "overdue")) {
    const e = events.find((x) => x.id === p.event_id)!
    run("deposit_reminder", addDays(new Date(String(p.due_date)), 1), `Rappel d'acompte envoyé à ${e.couple_names}`, { eventId: e.id })
  }

  // Quelques actions manuelles de l'équipe
  for (const l of faker.helpers.arrayElements(leads.filter((x) => x.stage === "proposal"), 3)) {
    activity.push({
      org_id: org.id,
      external_id: `demo-user-${l.external_id}`,
      type: "lead.follow_up",
      status: "success",
      actor: "user",
      actor_user_id: ownerId,
      lead_id: l.id,
      title: `Relance demandée pour ${name(l)}`,
      occurred_at: iso(subDays(NOW, faker.number.int({ min: 0, max: 4 }))),
    })
  }

  // Complète jusqu'à exactement 300 avec l'activité courante des 30 derniers jours
  while (activity.length < 300) {
    const l = pick(leads)
    run(
      pick(["lead_qualification", "meeting_reminder", "checklist_milestones", "proposal_follow_up_j3"]),
      faker.date.between({ from: subDays(NOW, 30), to: NOW }),
      `Suivi automatique pour ${name(l)}`,
      { lead: l },
    )
  }
  activity.splice(300)
  // Les derniers éléments ne doivent pas être dans le futur
  for (const a of activity) if (String(a.occurred_at) > iso(NOW)) a.occurred_at = iso(subDays(NOW, 1))
  await insertBatches("automation_events", activity)

  // Clé d'ingestion de démo (pour scripts/send-test-event.ts)
  const key = generateApiKey()
  await must(
    db.from("api_keys").insert({
      org_id: org.id,
      key_id: key.keyId,
      secret_enc: encrypt(key.secret, ENCRYPTION_KEY),
      last4: key.last4,
      label: "démo",
      created_by: ownerId,
    }),
  )

  return { org, leads: leads.length, events: events.length, activity: activity.length, key }
}

async function seedWitness(ownerId: string) {
  await resetOrg("atelier-temoin")
  const org = await provisionOrganization(db, {
    name: "Atelier Témoin",
    slug: "atelier-temoin",
    ownerId,
    encryptionKey: ENCRYPTION_KEY,
    accentColor: "#1F2A44",
  })
  await must(
    db.from("leads").insert(
      ["Inès", "Lucas", "Nora"].map((first_name, i) => ({
        org_id: org.id,
        external_id: `witness-${i}`,
        first_name,
        last_name: "Témoin",
        source: pick(SOURCES),
        budget_cents: 2_000_000,
      })),
    ),
  )
  return org
}

async function main() {
  console.log("→ Utilisateurs de démo")
  const ownerId = await ensureUser(DEMO_EMAIL, "Claire Martin")
  const witnessId = await ensureUser(WITNESS_EMAIL, "Agence Témoin")

  console.log("→ Maison Lumière")
  const demo = await seedMaisonLumiere(ownerId)
  console.log(`  ${demo.leads} leads, ${demo.events} mariages, ${demo.activity} événements d'automatisation`)

  console.log("→ Atelier Témoin (isolation RLS)")
  await seedWitness(witnessId)

  console.log(`
✓ Données de démo prêtes.

  Connexion : ${DEMO_EMAIL} (mot de passe : DEMO_USER_PASSWORD de .env.local)
  Témoin    : ${WITNESS_EMAIL} (même mot de passe) — ne doit voir aucune donnée de Maison Lumière.

  Clé d'ingestion de démo — à copier dans .env.local pour « npm run send-test-event » :
    EM_API_KEY_ID=${demo.key.keyId}
    EM_API_SECRET=${demo.key.secret}
`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
