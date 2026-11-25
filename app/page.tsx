/**
 * app/page.tsx — the home page ("/").
 *
 * For now a placeholder that proves the scaffold works: Hebrew text, RTL, the Heebo font.
 * In KQ-8 this becomes the PIN entry screen for participants who didn't scan the QR code.
 *
 * This is a Server Component (no "use client" at the top): it renders to HTML on the server.
 */
import { t } from "@/strings/he";

export default function HomePage() {
  return (
    // `flex-1` stretches the main area to fill the screen; `items-center` centers it.
    <main className="ml-4 flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-4xl font-bold">{t.home.title}</h1>
      <p className="text-lg opacity-80">{t.home.subtitle}</p>
    </main>
  );
}
