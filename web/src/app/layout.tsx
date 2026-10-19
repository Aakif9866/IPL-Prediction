import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "IPL 2027 Forecast Lab", template: "%s · IPL 2027 Forecast Lab" },
  description: "Model-backed IPL 2027 champion probabilities, batter run forecasts and an interactive Monte Carlo simulation lab.",
  openGraph: { title: "IPL 2027 Forecast Lab", description: "Champion probabilities, batter forecasts and a simulation lab — built from historical IPL data.", type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Runs before paint: stored choice, else OS preference. Guarded because storage can be blocked.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark")}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-card focus:p-3 focus:text-ink">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="page-fade mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
