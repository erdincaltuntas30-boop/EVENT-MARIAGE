import { RealtimeBridge } from "@/components/app/realtime-bridge"
import { MobileNav, Sidebar } from "@/components/app/sidebar"
import { requireOrg } from "@/lib/org"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg()
  // Couleur d'accent de l'agence appliquée à toute la page (y compris menus et dialogues en portail).
  const accent = /^#[0-9a-f]{6}$/i.test(ctx.org.accent_color) ? ctx.org.accent_color : "#4F6B5A"
  return (
    <div className="flex min-h-svh">
      <style>{`:root{--brand:${accent}}`}</style>
      <Sidebar
        org={{ id: ctx.org.id, name: ctx.org.name, logoUrl: ctx.org.logo_url }}
        organizations={ctx.organizations}
        user={{ name: ctx.fullName, email: ctx.email, role: ctx.role }}
      />
      <div className="min-w-0 flex-1">
        <MobileNav orgName={ctx.org.name} />
        <main className="px-6 py-8 md:px-10 lg:px-14 lg:py-12">
          <div className="mx-auto max-w-[1280px]">{children}</div>
        </main>
      </div>
      <RealtimeBridge orgId={ctx.org.id} />
    </div>
  )
}
