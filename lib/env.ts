import { z } from "zod"

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
})

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // 32 octets en base64 : `openssl rand -base64 32`
  APP_ENCRYPTION_KEY: z.string().min(40),
})

/**
 * Mode démo : actif quand Supabase n'est pas configuré (ou forcé par NEXT_PUBLIC_DEMO_MODE=1).
 * L'app affiche alors des données fictives en lecture seule, sans aucune requête réseau.
 */
export const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_DEMO_MODE === "1"

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || (isDemoMode ? "https://demo.invalid" : undefined),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (isDemoMode ? "demo" : undefined),
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
})

let cached: z.infer<typeof serverSchema> | null = null
export function serverEnv() {
  if (typeof window !== "undefined") throw new Error("serverEnv() côté navigateur")
  cached ??= serverSchema.parse(process.env)
  return cached
}
