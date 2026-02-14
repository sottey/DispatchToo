import { describe, expect, it } from "vitest";
import { addDaysToDateKey, endOfMonthDateKey, formatDateKey } from "@/lib/datetime";

describe("datetime helpers", () => {
  it("formats date key for an explicit timezone", () => {
    const source = new Date("2026-02-14T07:30:00.000Z");
    expect(formatDateKey(source, "America/Los_Angeles")).toBe("2026-02-13");
    expect(formatDateKey(source, "UTC")).toBe("2026-02-14");
  });

  it("adds days to a date key across month/year boundaries", () => {
    expect(addDaysToDateKey("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysToDateKey("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("computes end-of-month date keys", () => {
    expect(endOfMonthDateKey(2026, 2)).toBe("2026-02-28");
    expect(endOfMonthDateKey(2024, 2)).toBe("2024-02-29");
  });
});
