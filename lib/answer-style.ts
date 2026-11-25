/**
 * lib/answer-style.ts — the color and symbol of each answer option, shared by the projector and phones.
 *
 * Each option gets a color AND a shape, so people who can't tell colors apart (or a washed-out
 * projector) can still match "the triangle" on the screen to the triangle on their phone.
 * Tailwind needs to see full class names in the source to include them, so they're spelled out here.
 */
export const ANSWER_STYLES = [
  { bg: "bg-red-600", symbol: "▲", name: "triangle" },
  { bg: "bg-blue-600", symbol: "◆", name: "diamond" },
  { bg: "bg-amber-500", symbol: "●", name: "circle" },
  { bg: "bg-green-600", symbol: "■", name: "square" },
] as const;

/** True/false questions use a fixed pair: green for "true" (first option), red for "false". */
export const TF_STYLES = [
  { bg: "bg-green-600", symbol: "✓", name: "true" },
  { bg: "bg-red-600", symbol: "✗", name: "false" },
] as const;

export function answerStyle(type: "mc" | "tf", index: number) {
  return type === "tf" ? TF_STYLES[index] : ANSWER_STYLES[index];
}
