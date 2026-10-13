"use client"

import { UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { inviteMember, removeMember, updateMemberRole } from "@/app/actions/settings"
import { useActionToast } from "@/components/leads/lead-actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { MemberRole } from "@/lib/types"

export interface Member {
  userId: string
  name: string
  email: string
  role: MemberRole
}

export function TeamManager({ members, currentUserId, isAdmin }: { members: Member[]; currentUserId: string; isAdmin: boolean }) {
  const t = useTranslations()
  const router = useRouter()
  const notify = useActionToast()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<MemberRole>("planner")

  const run = (fn: () => Promise<Parameters<typeof notify>[0]>, after?: () => void) =>
    start(async () => {
      const res = await fn()
      notify(res)
      if (res.ok) after?.()
      router.refresh()
    })

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl">{t("settings.team.title")}</h2>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">{t("settings.team.rolesHint")}</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus />
                {t("settings.team.invite")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl font-normal">{t("settings.team.inviteTitle")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">{t("settings.team.email")}</Label>
                  <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("settings.team.role")}</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{t(`settings.team.roles.${role}`)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planner">{t("settings.team.roles.planner")}</SelectItem>
                      <SelectItem value="admin">{t("settings.team.roles.admin")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={pending || !email}
                  onClick={() =>
                    run(
                      () => inviteMember({ email, role }),
                      () => {
                        setOpen(false)
                        setEmail("")
                      },
                    )
                  }
                >
                  {t("settings.team.invite")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <ul className="surface divide-y divide-border/60">
        {members.map((m) => {
          const self = m.userId === currentUserId
          return (
            <li key={m.userId} className="flex items-center gap-4 px-5 py-4">
              <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                {m.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {m.name}
                  {self && <span className="ml-2 text-xs text-muted-foreground">({t("settings.team.you")})</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              {isAdmin && !self ? (
                <>
                  <Select value={m.role} onValueChange={(v) => run(() => updateMemberRole(m.userId, v as MemberRole))} disabled={pending}>
                    <SelectTrigger className="w-40">
                      <SelectValue>{t(`settings.team.roles.${m.role}`)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planner">{t("settings.team.roles.planner")}</SelectItem>
                      <SelectItem value="admin">{t("settings.team.roles.admin")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => removeMember(m.userId))}>
                    {t("settings.team.remove")}
                  </Button>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">{t(`settings.team.roles.${m.role}`)}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
