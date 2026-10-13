import { createBrowserClient } from "@supabase/ssr"
import { createDemoClient } from "@/lib/demo/client"
import { isDemoMode, publicEnv } from "@/lib/env"

function createClient() {
  return createBrowserClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

let client: ReturnType<typeof createClient> | null = null

export function supabaseBrowser() {
  client ??= isDemoMode ? (createDemoClient() as unknown as ReturnType<typeof createClient>) : createClient()
  return client
}
