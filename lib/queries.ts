"use client"

import { useQuery } from "@tanstack/react-query"
import { supabaseBrowser } from "@/lib/supabase/browser"
import { ACTIVITY_SELECT, type ActivityWithRefs } from "@/lib/activity"
import type { Lead } from "@/lib/types"

export const queryKeys = {
  activity: (orgId: string, scope: { leadId?: string; eventId?: string } = {}) =>
    ["activity", orgId, scope.leadId ?? null, scope.eventId ?? null] as const,
  leads: (orgId: string) => ["leads", orgId] as const,
}

export function useActivity(opts: {
  orgId: string
  leadId?: string
  eventId?: string
  limit?: number
  initialData?: ActivityWithRefs[]
}) {
  return useQuery({
    queryKey: queryKeys.activity(opts.orgId, opts),
    initialData: opts.initialData,
    queryFn: async () => {
      let q = supabaseBrowser()
        .from("automation_events")
        .select(ACTIVITY_SELECT)
        .eq("org_id", opts.orgId)
        .order("occurred_at", { ascending: false })
        .limit(opts.limit ?? 20)
      if (opts.leadId) q = q.eq("lead_id", opts.leadId)
      if (opts.eventId) q = q.eq("event_id", opts.eventId)
      const { data, error } = await q
      if (error) throw error
      return data as ActivityWithRefs[]
    },
  })
}

export function useLeads(orgId: string, initialData: Lead[]) {
  return useQuery({
    queryKey: queryKeys.leads(orgId),
    initialData,
    queryFn: async () => {
      const { data, error } = await supabaseBrowser()
        .from("leads")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as Lead[]
    },
  })
}
