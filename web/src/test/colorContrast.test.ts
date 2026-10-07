import { describe, expect, it } from "vitest";
import { contrastRatio, luminance, parseOklch } from "./colorContrast";

const WHITE = parseOklch("oklch(1 0 0)");
const BLACK = parseOklch("oklch(0 0 0)");

describe("color helper used by the toast contrast test", () => {
  it("parses both notations of the theme files", () => {
    const percent = parseOklch("oklch(97.9% 0.021 166.113)");
    expect(percent.l).toBeCloseTo(0.979, 10);
    expect([percent.c, percent.h]).toEqual([0.021, 166.113]);
    expect(parseOklch("oklch(0.985 0.004 90)")).toEqual({ l: 0.985, c: 0.004, h: 90 });
    expect(() => parseOklch("oklch(1 0 0 / 10%)")).toThrow();
  });

  it("white on black is 21:1 and a color against itself is 1:1", () => {
    expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 5);
    expect(contrastRatio(WHITE, WHITE)).toBe(1);
  });

  it("a neutral gray of lightness 0.5 has luminance 0.125, so 6:1 against white", () => {
    const gray = parseOklch("oklch(0.5 0 0)");
    expect(luminance(gray)).toBeCloseTo(0.125, 6);
    expect(contrastRatio(WHITE, gray)).toBeCloseTo(6, 5);
  });

  it("pure sRGB red, written in OKLCH, has the red luminance coefficient 0.2126", () => {
    expect(luminance(parseOklch("oklch(0.62796 0.25768 29.234)"))).toBeCloseTo(0.2126, 3);
  });
});
