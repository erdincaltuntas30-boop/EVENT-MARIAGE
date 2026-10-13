import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon: LucideIcon
  title?: string
  description: string
  action?: React.ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-8" : "py-20", className)}>
      <div className="relative mb-5">
        <div className="absolute inset-0 -m-3 rounded-full bg-accent/60 blur-md" />
        <div className="relative flex size-12 items-center justify-center rounded-full bg-card shadow-[var(--shadow-soft)]">
          <Icon className="size-5 text-primary" strokeWidth={1.5} />
        </div>
      </div>
      {title && <h3 className="text-2xl">{title}</h3>}
      <p className={cn("max-w-sm text-sm text-muted-foreground", title && "mt-2")}>{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
