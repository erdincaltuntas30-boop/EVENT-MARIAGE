import { z } from "zod"

const supabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // 32 octets en base64 : `openssl rand -base64 32`
  APP_ENCRYPTION_KEY: z.string().min(40),
})

// Les variables NEXT_PUBLIC_* doivent être lues littéralement pour être injectées dans le navigateur.
const supabase = supabaseSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
})

const forcedDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "1"
const partiallyConfigured = !supabase.success && !!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

if (partiallyConfigured && typeof window === "undefined") {
  console.warn(
    "[Event Mariage] Configuration Supabase incomplète ou invalide " +
      "(NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requises) : démarrage en mode démo.",
  )
}

/**
 * Mode démo : actif quand Supabase n'est pas (correctement) configuré, ou forcé par NEXT_PUBLIC_DEMO_MODE=1.
 * L'app affiche alors des données fictives en lecture seule, sans aucune requête réseau.
 * Ne lève jamais d'erreur au chargement : un déploiement sans configuration reste consultable.
 */
export const isDemoMode = forcedDemo || !supabase.success

function appUrl() {
  const candidate =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  return z.url().safeParse(candidate).success ? candidate.replace(/\/$/, "") : "http://localhost:3000"
}

export const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: supabase.success ? supabase.data.NEXT_PUBLIC_SUPABASE_URL : "https://demo.invalid",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: supabase.success ? supabase.data.NEXT_PUBLIC_SUPABASE_ANON_KEY : "demo",
  NEXT_PUBLIC_APP_URL: appUrl(),
}

let cached: z.infer<typeof serverSchema> | null = null
/** Secrets serveur, validés à la première utilisation (jamais pendant le build). */
export function serverEnv() {
  if (typeof window !== "undefined") throw new Error("serverEnv() côté navigateur")
  cached ??= serverSchema.parse(process.env)
  return cached
}
