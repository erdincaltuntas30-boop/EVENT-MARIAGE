import { beforeEach, describe, expect, it } from "vitest"
import { IngestError, ingestAutomationRun, ingestEvent, ingestLead, ingestPayment } from "@/lib/ingest/handlers"
import { MemoryIngestRepo } from "@/lib/ingest/repo"
import { automationRunSchema, eventSchema, leadSchema, paymentSchema } from "@/lib/ingest/schemas"

const ORG = "org-1"
let repo: MemoryIngestRepo

beforeEach(() => {
  repo = new MemoryIngestRepo()
})

const lead = leadSchema.parse({ external_id: "form-1", first_name: "Camille", last_name: "Durand", budget: 25000 })

describe("idempotence", () => {
  it("un même lead envoyé deux fois n'est créé qu'une fois", async () => {
    expect(await ingestLead(repo, ORG, lead)).toBe("created")
    expect(await ingestLead(repo, ORG, { ...lead, guest_count: 90 })).toBe("updated")
    expect(repo.rows("leads")).toHaveLength(1)
    expect(repo.rows("leads")[0].budget_cents).toBe(2_500_000)
    expect(repo.rows("leads")[0].guest_count).toBe(90)
    expect(repo.rows("automation_events").filter((e) => e.type === "lead.received")).toHaveLength(1)
  })

  it("un champ absent n'efface pas la valeur existante", async () => {
    await ingestLead(repo, ORG, lead)
    await ingestLead(repo, ORG, leadSchema.parse({ external_id: "form-1", first_name: "Camille" }))
    expect(repo.rows("leads")[0].budget_cents).toBe(2_500_000)
  })

  it("les organisations sont isolées", async () => {
    await ingestLead(repo, ORG, lead)
    expect(await ingestLead(repo, "org-2", lead)).toBe("created")
    expect(repo.rows("leads")).toHaveLength(2)
  })

  it("une exécution rejouée ne crée pas de doublon", async () => {
    const run = automationRunSchema.parse({
      external_id: "exec-1",
      automation_key: "lead_instant_reply",
      status: "success",
      title: "Réponse envoyée",
      lead_external_id: "form-1",
      first_response: true,
    })
    await ingestLead(repo, ORG, lead)
    await ingestAutomationRun(repo, ORG, run)
    await ingestAutomationRun(repo, ORG, run)
    expect(repo.rows("automation_events").filter((e) => e.type === "automation.run")).toHaveLength(1)
    expect(repo.rows("leads")[0].first_response_at).toBeTruthy()
  })
})

describe("automatisations", () => {
  it("crée en pause une automatisation inconnue", async () => {
    await ingestAutomationRun(
      repo,
      ORG,
      automationRunSchema.parse({ external_id: "e", automation_key: "nouvelle_auto", status: "success", title: "t" }),
    )
    expect(repo.rows("automations")[0]).toMatchObject({ key: "nouvelle_auto", is_enabled: false })
  })

  it("respecte la pause si demandé", async () => {
    await repo.insert("automations", { org_id: ORG, key: "review_request", is_enabled: false })
    const run = automationRunSchema.parse({
      external_id: "e",
      automation_key: "review_request",
      status: "success",
      title: "t",
      respect_pause: true,
    })
    await expect(ingestAutomationRun(repo, ORG, run)).rejects.toBeInstanceOf(IngestError)
  })

  it("complète l'action en attente grâce au request_id", async () => {
    const auto = await repo.insert("automations", { org_id: ORG, key: "proposal_follow_up_j3", is_enabled: true })
    await repo.insert("automation_events", {
      org_id: ORG,
      external_id: "req-1",
      automation_id: auto.id,
      status: "pending",
      actor: "user",
      title: "Relance demandée",
    })
    await ingestAutomationRun(
      repo,
      ORG,
      automationRunSchema.parse({
        external_id: "exec-9",
        request_id: "req-1",
        automation_key: "proposal_follow_up_j3",
        status: "error",
        title: "Relance non envoyée",
        error_message: "Adresse email invalide",
      }),
    )
    const rows = repo.rows("automation_events")
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ status: "error", actor: "user", error_message: "Adresse email invalide" })
  })
})

describe("mariages et acomptes", () => {
  it("un mariage signé passe le lead en « Signé »", async () => {
    await ingestLead(repo, ORG, lead)
    await ingestEvent(repo, ORG, eventSchema.parse({ external_id: "evt-1", lead_external_id: "form-1", title: "Mariage", date: "2027-06-12", contract_amount: 24000 }))
    expect(repo.rows("leads")[0].stage).toBe("won")
    expect(repo.rows("events")[0].contract_amount_cents).toBe(2_400_000)
  })

  it("un acompte sur un mariage inconnu renvoie 422", async () => {
    const p = paymentSchema.parse({ external_id: "p", event_external_id: "nope", label: "Acompte", amount: 100 })
    await expect(ingestPayment(repo, ORG, p)).rejects.toMatchObject({ status: 422 })
  })
})
