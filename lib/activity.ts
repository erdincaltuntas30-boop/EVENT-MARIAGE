import type { ActivityEvent } from "@/lib/types"

/** Colonnes d'une ligne d'activité avec le nom de l'automatisation et du lead liés. */
export const ACTIVITY_SELECT = "*, automations(name), leads(first_name, last_name)"

export type ActivityWithRefs = ActivityEvent & {
  automations: { name: string } | null
  leads: { first_name: string; last_name: string | null } | null
}
