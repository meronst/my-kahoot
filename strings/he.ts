/**
 * strings/he.ts — every piece of text the user sees, in one place.
 *
 * Why a strings file when the app is Hebrew-only?
 *  - One place to fix wording, typos or tone, without hunting through components.
 *  - Components stay readable: `t.home.title` instead of long Hebrew literals mixed into markup.
 *  - If an English or Arabic version is ever needed, we add `en.ts` with the same shape.
 *
 * `as const` makes TypeScript treat every value as a fixed literal (like a Java `static final`),
 * so a typo such as `t.home.titel` is a compile error, not an empty string at runtime.
 */
export const he = {
  app: {
    name: "החידון שלי",
    description: "חידון חי בעברית לשילוב בהרצאות",
  },
  home: {
    title: "החידון שלי",
    subtitle: "בקרוב: הצטרפות לחידון עם קוד או סריקת QR",
  },
} as const;

/** Short alias used in components: `import { t } from "@/strings/he"`. */
export const t = he;
