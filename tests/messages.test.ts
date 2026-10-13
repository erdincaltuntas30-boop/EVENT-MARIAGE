import { describe, expect, it } from "vitest"
import en from "@/messages/en.json"
import fr from "@/messages/fr.json"
import nl from "@/messages/nl.json"

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

describe("traductions", () => {
  const reference = keys(fr).sort()
  it.each([
    ["en", en],
    ["nl", nl],
  ])("%s contient exactement les clés du français", (_, messages) => {
    expect(keys(messages).sort()).toEqual(reference)
  })

  it("aucune clé ne contient de point (interdit par next-intl)", () => {
    const dotted = (obj: object): string[] =>
      Object.entries(obj).flatMap(([k, v]) => [...(k.includes(".") ? [k] : []), ...(v && typeof v === "object" ? dotted(v) : [])])
    for (const m of [fr, en, nl]) expect(dotted(m)).toEqual([])
  })
})
