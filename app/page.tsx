/**
 * app/page.tsx — the home page ("/"): where a participant types the game code if they didn't scan
 * the QR code. The QR code skips this page and opens /j/<PIN> directly.
 *
 * A Server Component; the interactive part is the PinForm Client Component.
 */
import { t } from "@/strings/he";
import { PinForm } from "./pin-form";

export default function HomePage() {
  return (
    // `flex-1` stretches the main area to fill the screen; `items-center` centers it.
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-bold">{t.home.title}</h1>
      <p className="text-lg opacity-80">{t.home.subtitle}</p>
      <PinForm />
    </main>
  );
}
