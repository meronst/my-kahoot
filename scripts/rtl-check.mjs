#!/usr/bin/env node
/**
 * scripts/rtl-check.mjs — fails CI if code uses physical left/right styling instead of logical start/end.
 *
 * Why: the app is right-to-left. `margin-left` or Tailwind `ml-4` puts space on the wrong side in RTL;
 * `margin-inline-start` / `ms-4` follow the text direction. See app/globals.css for the full rule.
 *
 * Replaces the original one-line grep, which flagged comments and the word "right-to-left" (bug KQ-23).
 * This version:
 *   1. blanks out comments first (keeping line numbers), so explanations never trigger it;
 *   2. checks Tailwind classes only inside className="..." / class="..." values, so ordinary words
 *      like "right-click" or a URL containing "ml-4" don't trigger it;
 *   3. checks CSS properties in .css/.scss and inline style objects in .ts/.tsx.
 * Known limit: classes built with helpers like clsx("ml-4") aren't scanned; prefer plain className strings.
 *
 * Escape hatch: put `rtl-ok` on a line (in a comment) when a physical side is truly intended,
 * e.g. something pinned to the projector's left edge.
 *
 * Usage:  node scripts/rtl-check.mjs [dir ...]      (default: app components lib)
 * Exit code 1 when violations are found — that's what fails the CI job.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const CODE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const STYLE_EXTS = new Set([".css", ".scss"]);

/**
 * Replace comments with spaces so line/column positions stay the same.
 * Block comments: CSS and JS. Line comments (`// ...`): JS/TS and SCSS only (plain CSS has none).
 * `//` right after a colon is skipped so URLs like https://... aren't treated as comments.
 * @param {string} text
 * @param {string} ext
 * @returns {string}
 */
function stripComments(text, ext) {
  const blank = (s) => s.replace(/[^\n]/g, " ");
  let out = text.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (CODE_EXTS.has(ext) || ext === ".scss") {
    out = out.replace(/(^|[^:\\])(\/\/[^\n]*)/gm, (_m, before, comment) => before + blank(comment));
  }
  return out;
}

/** Physical CSS properties, for .css/.scss files. */
const CSS_RULES = [
  { re: /\b(margin|padding|border|inset|scroll-margin|scroll-padding)-(left|right)\b/, why: "physical property; use the -inline-start / -inline-end form" },
  { re: /(^|[\s;{])(left|right)\s*:/, why: "`left:`/`right:`; use inset-inline-start / inset-inline-end" },
  { re: /\btext-align\s*:\s*(left|right)\b/, why: "text-align left/right; use start / end" },
  { re: /\b(float|clear)\s*:\s*(left|right)\b/, why: "float/clear left/right; use inline-start / inline-end" },
];

/** Physical properties in React inline styles, e.g. style={{ marginLeft: 8 }}. */
const STYLE_OBJECT_RULES = [
  { re: /\b(margin|padding|border)(Left|Right)\b/, why: "inline style marginLeft/paddingRight...; use marginInlineStart etc." },
  { re: /\b(textAlign|float)\s*:\s*["'](left|right)["']/, why: "inline style left/right; use start / end" },
];

/** Tailwind utilities that hard-code a physical side (checked after removing variants like md: or hover:). */
const TAILWIND_PHYSICAL = [
  /^(ml|mr|pl|pr|scroll-ml|scroll-mr|scroll-pl|scroll-pr)-/,
  /^(left|right)-/,
  /^(text|float|clear)-(left|right)$/,
  /^rounded-(l|r|tl|tr|bl|br)(-|$)/,
  /^border-(l|r)(-|$)/,
];

/** Finds class strings: className="..."  class='...'  className={`...`}  className={"..."} */
const CLASS_ATTR = /\bclass(?:Name)?\s*=\s*(?:\{\s*)?(["'`])([\s\S]*?)\1/g;

/**
 * Returns the physical Tailwind classes in one class string.
 * @param {string} classes
 */
function physicalClasses(classes) {
  return classes
    .split(/\s+/)
    .map((token) => token.split(":").pop().replace(/^[!-]+/, "")) // "md:hover:-ml-2" → "ml-2"
    .filter((cls) => TAILWIND_PHYSICAL.some((re) => re.test(cls)));
}

/**
 * Pure function (no file access), so it's easy to unit-test.
 * @param {string} text   file contents
 * @param {string} file   file path, used for the extension and in messages
 * @returns {{ file: string, line: number, why: string }[]}
 */
export function findViolations(text, file) {
  const ext = extname(file);
  const original = text.split("\n");
  const code = stripComments(text, ext);
  const codeLines = code.split("\n");
  const found = new Map(); // line number → reason (one report per line is enough)

  const report = (line, why) => {
    if (!original[line - 1]?.includes("rtl-ok") && !found.has(line)) found.set(line, why);
  };

  const lineRules = STYLE_EXTS.has(ext) ? CSS_RULES : CODE_EXTS.has(ext) ? STYLE_OBJECT_RULES : [];
  codeLines.forEach((lineText, i) => {
    for (const { re, why } of lineRules) if (re.test(lineText)) report(i + 1, why);
  });

  if (CODE_EXTS.has(ext) || ext === ".html") {
    for (const match of code.matchAll(CLASS_ATTR)) {
      const bad = physicalClasses(match[2]);
      if (bad.length) {
        const line = code.slice(0, match.index).split("\n").length;
        report(line, `Tailwind ${bad.join(", ")}; use ms-/me-/ps-/pe-/start-/end-/text-start/rounded-s/border-s`);
      }
    }
  }

  return [...found].sort((a, b) => a[0] - b[0]).map(([line, why]) => ({ file, line, why }));
}

/** Recursively lists checkable files under a directory. */
function listFiles(dir) {
  return readdirSync(dir, { recursive: true })
    .map((p) => join(dir, String(p)))
    .filter((p) => statSync(p).isFile())
    .filter((p) => CODE_EXTS.has(extname(p)) || STYLE_EXTS.has(extname(p)) || extname(p) === ".html");
}

// Run as a CLI only when executed directly (not when imported by the tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ["app", "components", "lib"];
  const violations = dirs
    .filter((d) => existsSync(d))
    .flatMap(listFiles)
    .flatMap((f) => findViolations(readFileSync(f, "utf8"), f));

  for (const v of violations) console.log(`${v.file}:${v.line}  ${v.why}`);
  if (violations.length) {
    console.error(`\nRTL check failed: ${violations.length} problem(s). Add 'rtl-ok' to a line only if the physical side is intended.`);
    process.exit(1);
  }
  console.log("RTL check passed.");
}
