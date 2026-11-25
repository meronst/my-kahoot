/**
 * app/host/login/page.tsx — the host login page (/host/login).
 *
 * A Server Component that only lays out the page; the interactive form is the LoginForm
 * Client Component. Nothing here reads cookies, so Next.js can prerender this page as static HTML.
 */
import { t } from "@/strings/he";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold">{t.login.title}</h1>
      <LoginForm />
    </main>
  );
}
