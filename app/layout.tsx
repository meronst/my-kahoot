/**
 * app/layout.tsx — the ROOT LAYOUT: the HTML shell that wraps every page in the app.
 *
 * Concept — layouts in the Next.js App Router:
 *   A folder under `app/` is a URL segment; `page.tsx` is what renders at that URL, and `layout.tsx`
 *   wraps every page below it. This root layout is required and is the only place that renders
 *   <html> and <body>. Think of it as the master template (like a JSP/Thymeleaf base template).
 *
 * Concept — Server Components:
 *   By default every component here runs on the SERVER and sends plain HTML to the browser
 *   (no JavaScript shipped for it). We'll only mark components with "use client" when they need
 *   browser-only things: clicks, state, timers, live updates.
 *
 * Hebrew / RTL:
 *   `lang="he"` tells browsers and screen readers the language; `dir="rtl"` flips the whole layout
 *   right-to-left. Because it's set once here, every page inherits it.
 */
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { t } from "@/strings/he";
import "./globals.css";

/**
 * Heebo font, self-hosted from the @fontsource package (no request to Google at runtime).
 * `next/font/local` preloads the file and generates a CSS variable, which avoids the text
 * "jumping" when the font arrives. Hebrew + Latin subsets cover Hebrew text with English/numbers inside.
 */
const heebo = localFont({
  src: [
    { path: "../node_modules/@fontsource-variable/heebo/files/heebo-hebrew-wght-normal.woff2", weight: "100 900" },
    { path: "../node_modules/@fontsource-variable/heebo/files/heebo-latin-wght-normal.woff2", weight: "100 900" },
  ],
  variable: "--font-heebo",
  display: "swap",
});

/** <title> and <meta description>; Next.js renders these into <head> for us. */
export const metadata: Metadata = {
  title: t.app.name,
  description: t.app.description,
};

/** Mobile viewport: participants play on phones, so the page must fit the screen width. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * `LayoutProps<"/">` is a type Next.js generates from the folder structure, so `children`
 * (the current page) is typed automatically.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
