"use client"

import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useOptimistic, useTransition } from "react"
import { toggleTask } from "@/app/actions/events"
import { Checkbox } from "@/components/ui/checkbox"
import { formatDate } from "@/lib/format"
import { MILESTONES, type EventTask } from "@/lib/types"
import { cn } from "@/lib/utils"

export function Checklist({ tasks }: { tasks: EventTask[] }) {
  const t = useTranslations("events")
  const locale = useLocale()
  const router = useRouter()
  const [, start] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(tasks, (state, { id, done }: { id: string; done: boolean }) =>
    state.map((x) => (x.id === id ? { ...x, done_at: done ? new Date().toISOString() : null } : x)),
  )
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      {MILESTONES.map((m) => {
        const items = optimistic.filter((x) => x.milestone === m)
        if (items.length === 0 && m !== "J-90" && m !== "J-30" && m !== "J-7") return null
        const done = items.filter((x) => x.done_at).length
        return (
          <div key={m} className="surface p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="font-display text-xl">{t(`milestones.${m}`)}</h3>
              <span className="text-xs text-muted-foreground tabular-nums">
                {done}/{items.length}
              </span>
            </div>
            {items.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">{t("tasksEmpty")}</p>
            ) : (
              <ul className="space-y-1">
                {items.map((task) => {
                  const late = !task.done_at && task.due_date && task.due_date < today
                  return (
                    <li key={task.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
                        <Checkbox
                          checked={!!task.done_at}
                          onCheckedChange={(checked) =>
                            start(async () => {
                              setOptimistic({ id: task.id, done: checked === true })
                              await toggleTask(task.id, checked === true)
                              router.refresh()
                            })
                          }
                        />
                        <span className={cn("flex-1 text-sm", task.done_at && "text-muted-foreground line-through")}>{task.title}</span>
                        {task.due_date && (
                          <span className={cn("text-xs tabular-nums", late ? "text-destructive" : "text-muted-foreground")}>
                            {formatDate(task.due_date, locale, { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
