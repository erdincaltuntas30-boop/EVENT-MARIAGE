import "server-only"
import { createClient } from "@supabase/supabase-js"
import { createDemoClient } from "@/lib/demo/client"
import { isDemoMode, publicEnv, serverEnv } from "@/lib/env"

function createAdminClient() {
  return createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Client service role : contourne la RLS.
 * À n'utiliser que côté serveur, après avoir établi l'organisation (clé API ou membership vérifiée).
 */
export function supabaseAdmin(): ReturnType<typeof createAdminClient> {
  if (isDemoMode) return createDemoClient() as unknown as ReturnType<typeof createAdminClient>
  return createAdminClient()
}
