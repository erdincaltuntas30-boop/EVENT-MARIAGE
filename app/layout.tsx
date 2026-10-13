import type { Metadata } from "next"
import { Cormorant_Garamond, Inter } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getLocale } from "next-intl/server"
import { Providers } from "@/components/app/providers"
import "./globals.css"

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] })
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
})

export const metadata: Metadata = {
  title: { default: "Event Mariage", template: "%s · Event Mariage" },
  description: "Le tableau de bord des agences d'événementiel et de mariage.",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  return (
    <html lang={locale}>
      <body className={`${inter.variable} ${cormorant.variable}`}>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
