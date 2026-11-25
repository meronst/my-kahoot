/**
 * tests/unit/question-image.test.ts — image size and path helpers (KQ-17).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fitWithin, imageUrl, newImagePath } from "@/lib/question-image";

describe("fitWithin", () => {
  it("shrinks the longest side to 1600 and keeps the proportions", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 }); // portrait
    expect(fitWithin(5000, 1000)).toEqual({ width: 1600, height: 320 });
  });
  it("never enlarges a small image", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });
});

describe("paths and URLs", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("puts each upload in its quiz's folder", () => {
    expect(newImagePath("q-1", "abc")).toBe("q-1/abc.jpg");
  });
  it("builds the public URL from the project URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk");
    expect(imageUrl("q-1/abc.jpg")).toBe("https://x.supabase.co/storage/v1/object/public/question-images/q-1/abc.jpg");
  });
});
