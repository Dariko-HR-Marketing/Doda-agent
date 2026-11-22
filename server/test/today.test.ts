import { describe, expect, it } from "vitest";
import { isDate, nextDue } from "../src/dates.js";

describe("sana yordamchilari", () => {
  it("isDate: to'g'ri va noto'g'ri sanalar", () => {
    for (const ok of ["2026-11-22", "2028-02-29"]) expect(isDate(ok), ok).toBe(true);
    for (const bad of ["2026-13-01", "2026-02-30", "2026-2-3", "22-11-2026", "", "2026-11-22T00:00", "abc"]) expect(isDate(bad), bad).toBe(false);
  });
  it("nextDue: kun, hafta, oy (oy oxiriga moslanadi, yil almashadi)", () => {
    expect(nextDue("2026-11-22", "daily")).toBe("2026-11-23");
    expect(nextDue("2026-12-31", "daily")).toBe("2027-01-01");
    expect(nextDue("2026-11-22", "weekly")).toBe("2026-11-29");
    expect(nextDue("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextDue("2028-01-31", "monthly")).toBe("2028-02-29");
    expect(nextDue("2026-12-15", "monthly")).toBe("2027-01-15");
    expect(nextDue("2026-11-22", "none")).toBe("2026-11-22");
  });
});
