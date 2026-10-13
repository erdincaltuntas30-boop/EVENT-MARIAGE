import "server-only"
import { createClient } from "@supabase/supabase-js"
import { publicEnv, serverEnv } from "@/lib/env"

/**
 * Client service role : contourne la RLS.
 * À n'utiliser que côté serveur, après avoir établi l'organisation (clé API ou membership vérifiée).
 */
export function supabaseAdmin() {
  return createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
