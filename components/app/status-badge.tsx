import { useTranslations } from "next-intl"
import type { ActivityStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const DOT: Record<ActivityStatus, string> = {
  success: "bg-success",
  error: "bg-destructive",
  pending: "bg-warning animate-pulse",
  info: "bg-muted-foreground/40",
}

export function StatusDot({ status, className }: { status: ActivityStatus; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", DOT[status], className)} />
}

export function StatusBadge({ status }: { status: ActivityStatus }) {
  const t = useTranslations("status")
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs",
        status === "error" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
      )}
    >
      <StatusDot status={status} />
      {t(status)}
    </span>
  )
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground", className)}>
      {children}
    </span>
  )
}
