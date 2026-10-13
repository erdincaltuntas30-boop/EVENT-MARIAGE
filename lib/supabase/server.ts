import "server-only"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createDemoClient } from "@/lib/demo/client"
import { isDemoMode, publicEnv } from "@/lib/env"

type CookieStore = Awaited<ReturnType<typeof cookies>>

function createClient(store: CookieStore) {
  return createServerClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options))
        } catch {
          // Appelé depuis un Server Component : le middleware rafraîchit la session.
        }
      },
    },
  })
}

/** Client lié à la session de l'utilisateur : toutes les requêtes passent par la RLS. */
export async function supabaseServer(): Promise<ReturnType<typeof createClient>> {
  if (isDemoMode) return createDemoClient() as unknown as ReturnType<typeof createClient>
  return createClient(await cookies())
}
