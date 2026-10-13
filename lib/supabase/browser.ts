import { createBrowserClient } from "@supabase/ssr"
import { publicEnv } from "@/lib/env"

let client: ReturnType<typeof createBrowserClient> | null = null

export function supabaseBrowser() {
  client ??= createBrowserClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  return client
}
