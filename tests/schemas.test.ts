import { describe, expect, it } from "vitest"
import { automationRunSchema, extractItems, leadSchema } from "@/lib/ingest/schemas"

describe("schémas d'ingestion", () => {
  it("valide un lead complet", () => {
    const r = leadSchema.safeParse({
      external_id: "form-1",
      source: "instagram",
      first_name: "Camille",
      email: "camille@example.fr",
      wedding_date: "2027-06-12",
      budget: 25000,
      guest_count: 120,
    })
    expect(r.success).toBe(true)
  })

  it("applique la source par défaut", () => {
    expect(leadSchema.parse({ external_id: "a", first_name: "A" }).source).toBe("other")
  })

  it("refuse une date invalide et un email invalide", () => {
    const r = leadSchema.safeParse({ external_id: "a", first_name: "A", wedding_date: "12/06/2027", email: "x" })
    expect(r.success).toBe(false)
  })

  it("refuse une clé d'automatisation non slug", () => {
    const r = automationRunSchema.safeParse({ external_id: "e", automation_key: "Relance J+3", status: "success", title: "t" })
    expect(r.success).toBe(false)
  })

  it("accepte un objet seul ou un lot", () => {
    expect(extractItems({ a: 1 })).toHaveLength(1)
    expect(extractItems({ items: [{}, {}] })).toHaveLength(2)
    expect(extractItems([1])).toBeNull()
  })
})
