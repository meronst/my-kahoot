/**
 * lib/phone.ts — Israeli mobile numbers (KQ-19). Pure; mirrors normalize_phone() in the database,
 * which has the final say. Used to warn on the join screen before anything is sent.
 */

/** "050-123 4567", "+972 50 1234567" → "0501234567"; anything else → null. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/[\s\-.()]/g, "");
  if (/^\+9725\d{8}$/.test(d)) d = "0" + d.slice(4);
  else if (/^9725\d{8}$/.test(d)) d = "0" + d.slice(3);
  return /^05\d{8}$/.test(d) ? d : null;
}
