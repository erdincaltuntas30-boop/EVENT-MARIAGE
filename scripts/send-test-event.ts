/**
 * Envoie un événement signé à l'API d'ingestion, comme le ferait n8n.
 *
 *   npm run send-test-event -- lead
 *   npm run send-test-event -- automation-run
 *   npm run send-test-event -- automation-run --replay     (renvoie le même external_id : aucun doublon)
 *   npm run send-test-event -- lead --bad-signature        (doit renvoyer 401)
 */
import { randomUUID } from "node:crypto"
import { sign } from "../lib/crypto"

const [type = "automation-run", ...flags] = process.argv.slice(2)
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
const keyId = process.env.EM_API_KEY_ID
const secret = process.env.EM_API_SECRET
if (!keyId || !secret) {
  console.error("Ajoutez EM_API_KEY_ID et EM_API_SECRET dans .env.local (affichés par « npm run seed »).")
  process.exit(1)
}

const suffix = flags.includes("--replay") ? "replay" : randomUUID().slice(0, 8)
const samples: Record<string, unknown> = {
  lead: {
    external_id: `test-lead-${suffix}`,
    source: "instagram",
    first_name: "Léa",
    last_name: "Fontaine",
    partner_name: "Mathis",
    email: "lea.fontaine@exemple.fr",
    wedding_date: "2027-09-18",
    budget: 32000,
    guest_count: 140,
    venue: "Domaine des Évis",
    message: "Bonjour, nous cherchons une agence pour un mariage champêtre en septembre 2027.",
  },
  "automation-run": {
    external_id: `test-run-${suffix}`,
    automation_key: "lead_instant_reply",
    status: flags.includes("--error") ? "error" : "success",
    title: flags.includes("--error") ? "Réponse non envoyée à Léa Fontaine" : "Réponse envoyée à Léa Fontaine",
    error_message: flags.includes("--error") ? "L'adresse email du destinataire est invalide." : null,
    detail: { channel: "email" },
  },
}

const payload = samples[type]
if (!payload) {
  console.error(`Type non géré par ce script : ${type}. Utilisez « lead » ou « automation-run ».`)
  process.exit(1)
}

const body = JSON.stringify(payload)
const timestamp = Math.floor(Date.now() / 1000)
const signature = flags.includes("--bad-signature") ? sign("mauvais-secret", timestamp, body) : sign(secret, timestamp, body)

async function main() {
  const res = await fetch(`${appUrl}/api/ingest/${type}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${keyId}`,
      "x-em-timestamp": String(timestamp),
      "x-em-signature": signature,
    },
    body,
  })
  console.log(res.status, await res.text())
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
