export type MemberRole = "admin" | "planner"
export type LeadSource = "form" | "instagram" | "mariages_net" | "email" | "other"
export type LeadStage = "new" | "qualified" | "meeting" | "proposal" | "won" | "lost"
export type EventStatus = "planned" | "done" | "cancelled"
export type TaskMilestone = "J-90" | "J-30" | "J-7" | "J-1" | "custom"
export type PaymentStatus = "pending" | "received" | "overdue"
export type ActivityStatus = "pending" | "success" | "error" | "info"
export type ActivityActor = "automation" | "user" | "system"
export type WebhookAction =
  | "lead.follow_up"
  | "lead.send_proposal"
  | "lead.stage_changed"
  | "automation.toggle"
  | "automation.retry"

export const LEAD_STAGES: LeadStage[] = ["new", "qualified", "meeting", "proposal", "won", "lost"]
export const LEAD_SOURCES: LeadSource[] = ["form", "instagram", "mariages_net", "email", "other"]
export const MILESTONES: TaskMilestone[] = ["J-90", "J-30", "J-7", "J-1", "custom"]
export const WEBHOOK_ACTIONS: WebhookAction[] = [
  "lead.follow_up",
  "lead.send_proposal",
  "lead.stage_changed",
  "automation.toggle",
  "automation.retry",
]

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  accent_color: string
  locale: string
  timezone: string
}

export interface Lead {
  id: string
  org_id: string
  external_id: string | null
  first_name: string
  last_name: string | null
  partner_name: string | null
  email: string | null
  phone: string | null
  source: LeadSource
  stage: LeadStage
  wedding_date: string | null
  budget_cents: number | null
  guest_count: number | null
  venue: string | null
  notes: string | null
  first_response_at: string | null
  lost_reason: string | null
  stage_changed_at: string
  created_at: string
  updated_at: string
}

export interface WeddingEvent {
  id: string
  org_id: string
  external_id: string | null
  lead_id: string | null
  title: string
  couple_names: string | null
  date: string
  venue: string | null
  guest_count: number | null
  contract_amount_cents: number
  status: EventStatus
  created_at: string
}

export interface EventTask {
  id: string
  event_id: string
  title: string
  milestone: TaskMilestone
  due_date: string | null
  done_at: string | null
}

export interface Vendor {
  id: string
  name: string
  category: string
  email: string | null
  phone: string | null
}

export interface Payment {
  id: string
  event_id: string
  label: string
  amount_cents: number
  due_date: string | null
  status: PaymentStatus
  received_at: string | null
}

export interface Automation {
  id: string
  org_id: string
  key: string
  name: string
  description: string | null
  trigger_label: string | null
  category: string
  is_enabled: boolean
  minutes_saved_per_run: number
}

export interface AutomationStats {
  automation_id: string
  runs_total: number
  runs_success: number
  runs_error: number
  runs_30d: number
  last_run_at: string | null
  last_status: ActivityStatus | null
}

export interface ActivityEvent {
  id: string
  org_id: string
  external_id: string
  automation_id: string | null
  type: string
  status: ActivityStatus
  actor: ActivityActor
  actor_user_id: string | null
  lead_id: string | null
  event_id: string | null
  title: string
  detail: Record<string, unknown>
  error_message: string | null
  occurred_at: string
}

export interface KpiRange {
  new_leads: number
  won_leads: number
  signed_revenue_cents: number
  avg_first_response_minutes: number | null
  hours_saved: number
}

export interface DashboardKpis {
  current: KpiRange
  previous: KpiRange
  forecast_revenue_cents: number
  open_leads: number
}
