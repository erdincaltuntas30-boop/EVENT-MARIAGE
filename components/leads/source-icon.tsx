import { AtSign, Camera, FileText, Heart, MoreHorizontal } from "lucide-react"
import type { LeadSource } from "@/lib/types"

const ICONS = { form: FileText, instagram: Camera, mariages_net: Heart, email: AtSign, other: MoreHorizontal }

export function SourceIcon({ source, className }: { source: LeadSource; className?: string }) {
  const Icon = ICONS[source]
  return <Icon className={className ?? "size-3.5"} strokeWidth={1.75} />
}
