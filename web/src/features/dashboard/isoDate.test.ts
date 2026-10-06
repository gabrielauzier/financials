import { describe, expect, it } from "vitest";
import { daysSince, formatIsoDate } from "./isoDate";

describe("isoDate", () => {
  it("formats YYYY-MM-DD as dd/mm/aaaa", () => {
    expect(formatIsoDate("2026-10-05")).toBe("05/10/2026");
  });

  it("counts whole local calendar days up to today, across months and leap years", () => {
    const now = new Date(2026, 9, 15, 23, 59, 0);
    expect(daysSince("2026-10-15", now)).toBe(0);
    expect(daysSince("2026-09-15", now)).toBe(30);
    expect(daysSince("2026-09-14", now)).toBe(31);
    expect(daysSince("2024-02-28", new Date(2024, 2, 1, 0, 1))).toBe(2);
  });
});
