export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex items-center justify-center px-6 py-16">{children}</div>
      <div className="relative hidden overflow-hidden bg-sidebar lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,color-mix(in_oklab,var(--brand)_18%,transparent),transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-end p-16">
          <p className="font-display max-w-md text-4xl leading-tight text-foreground/90">
            « Chaque demande reçoit une réponse, chaque mariage est préparé à temps. »
          </p>
          <p className="mt-6 text-sm text-muted-foreground">Event Mariage</p>
        </div>
      </div>
    </div>
  )
}
