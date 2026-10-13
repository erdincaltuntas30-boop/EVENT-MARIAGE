"use client"

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { supabaseBrowser } from "@/lib/supabase/browser"
import type { ActivityEvent, Lead } from "@/lib/types"

/**
 * Écoute les changements poussés par n8n (via l'API d'ingestion) et par les autres utilisateurs :
 * invalide les requêtes TanStack, rafraîchit les composants serveur et affiche une notification discrète.
 */
export function RealtimeBridge({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const t = useTranslations("live")
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = supabaseBrowser()
    const filter = `org_id=eq.${orgId}`

    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => router.refresh(), 800)
    }

    const channel = supabase
      .channel(`org:${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "automation_events", filter }, (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {        queryClient.invalidateQueries({ queryKey: ["activity", orgId] })
        scheduleRefresh()
        if (payload.eventType !== "INSERT" && payload.eventType !== "UPDATE") return
        const row = payload.new as unknown as ActivityEvent
        if (row.status === "error") {
          toast.error(t("error"), { description: row.title })
        } else if (payload.eventType === "INSERT" && row.actor === "automation") {
          toast(row.title, { duration: 3500 })
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter }, (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {        queryClient.invalidateQueries({ queryKey: ["leads", orgId] })
        scheduleRefresh()
        if (payload.eventType === "INSERT") {
          const lead = payload.new as unknown as Lead
          toast(t("newLead"), { description: [lead.first_name, lead.last_name].filter(Boolean).join(" ") })
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "automations", filter }, scheduleRefresh)
      .subscribe()

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      supabase.removeChannel(channel)
    }
  }, [orgId, queryClient, router, t])

  return null
}
