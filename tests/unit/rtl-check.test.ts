/**
 * tests/unit/rtl-check.test.ts — tests for scripts/rtl-check.mjs, the CI check that keeps the UI RTL-safe.
 *
 * The first group is the regression test for bug KQ-23: the original grep-based check flagged
 * comments that *explain* the rule and the plain word "right-to-left". Those cases must pass now.
 * The second group makes sure real violations are still caught.
 */
import { describe, expect, it } from "vitest";
import { findViolations } from "../../scripts/rtl-check.mjs";

/** Shorthand: the line numbers reported for a snippet. */
const lines = (code: string, file: string) => findViolations(code, file).map((v) => v.line);

describe("rtl-check: no false positives (regression KQ-23)", () => {
  it("ignores CSS block comments that mention physical properties", () => {
    const css = [
      "/*",
      " *   margin-left      → margin-inline-start   (Tailwind: ms-4)",
      " *   text-align: left → text-align: start",
      " */",
      "body { margin-inline-start: 1rem; }",
    ].join("\n");
    expect(lines(css, "app/globals.css")).toEqual([]);
  });

  it('ignores the word "right-to-left" and line comments in TSX', () => {
    const tsx = [
      "/**",
      " * `dir=\"rtl\"` flips the whole layout right-to-left.",
      " */",
      "// pl-4 would be wrong here, so we use ps-4",
      'export const A = () => <div className="ps-4">שלום</div>;',
    ].join("\n");
    expect(lines(tsx, "app/a.tsx")).toEqual([]);
  });

  it("ignores Tailwind-like words outside class attributes", () => {
    const tsx = 'const label = "right-click to open"; const url = "https://example.com/ml-4";';
    expect(lines(tsx, "app/b.tsx")).toEqual([]);
  });

  it("allows a line marked rtl-ok", () => {
    const css = ".logo { left: 0; } /* rtl-ok: logo pinned for the projector */";
    expect(lines(css, "app/c.css")).toEqual([]);
  });
});

describe("rtl-check: real violations are caught", () => {
  it("flags physical CSS properties", () => {
    const css = [
      ".a { margin-left: 4px; }",
      ".b { padding-right: 2px; }",
      ".c { text-align: right; }",
      ".d { float: left; }",
      ".e { left: 0; }",
    ].join("\n");
    expect(lines(css, "app/x.css")).toEqual([1, 2, 3, 4, 5]);
  });

  it("flags physical Tailwind classes inside className, including variants", () => {
    const tsx = [
      '<div className="flex ml-4">',
      '<p className="md:text-right">',
      "<span className={`p-2 ${x} hover:pr-2`}>",
      '<i className="rounded-l-lg border-r">',
    ].join("\n");
    expect(lines(tsx, "app/y.tsx")).toEqual([1, 2, 3, 4]);
  });

  it("flags physical properties in inline style objects", () => {
    const tsx = "<div style={{ marginLeft: 8, textAlign: 'left' }} />";
    expect(lines(tsx, "app/z.tsx")).toEqual([1]);
  });

  it("accepts logical equivalents", () => {
    const tsx = '<div className="ms-4 pe-2 text-start rounded-s-lg border-e start-0 end-0">';
    expect(lines(tsx, "app/ok.tsx")).toEqual([]);
  });
});
