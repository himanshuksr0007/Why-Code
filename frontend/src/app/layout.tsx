import { Suspense } from "react";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";

import { AppShell } from "@/components/app-shell";
import { ClerkShell } from "@/components/clerk-shell";
import { Providers } from "@/components/providers";
import { GridBackground } from "@/components/grid-background";
import { SITE_URL } from "@/lib/site";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

/** Serif used only for the WhyCode wordmark (brand text). */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600"],
});

const description =
  "Ask why a codebase works the way it does, and see the pull requests, reviews and commits that decided it.";
const shareImage = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "WhyCode. Ask why your code works the way it does.",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "WhyCode — AI Workspace",
    template: "%s · WhyCode",
  },
  description,
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    url: "./",
    title: "WhyCode — AI Workspace",
    description,
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "WhyCode — AI Workspace",
    description,
    images: [shareImage],
  },
  icons: {
    icon: [
      { url: "/whycode-logo.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${newsreader.variable} h-full`}
    >
      <body className="min-h-full antialiased bg-app-gradient relative">
        <ClerkShell>
          <GridBackground />
          <div className="relative z-10 min-h-full">
            <Providers>
              {/* AppShell reads the pathname; on dynamic routes that is
                  URL data, so the shell streams in behind a boundary
                  (the fallback renders the page content bare, exactly
                  like the shell's own standalone-pages branch). */}
              <Suspense
                fallback={<main className="relative min-h-svh">{children}</main>}
              >
                <AppShell>{children}</AppShell>
              </Suspense>
            </Providers>
          </div>
        </ClerkShell>
      </body>
    </html>
  );
}
