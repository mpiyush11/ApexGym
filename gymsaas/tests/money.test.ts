/** Money helper tests — integer minor units (Rule 2). No emulator needed. */
import { describe, test, expect } from "vitest";
import {
  toMinor,
  toMajor,
  formatMoney,
  addMinor,
  computeDueMinor,
} from "../src/lib/money/money";

describe("toMinor / toMajor", () => {
  test("rupees -> paise (integer)", () => {
    expect(toMinor(3200, "INR")).toBe(320000);
    expect(toMinor(0, "INR")).toBe(0);
  });
  test("rounds to nearest minor unit (no float drift)", () => {
    expect(toMinor(3200.005, "INR")).toBe(320001); // 320000.5 -> 320001
    expect(Number.isInteger(toMinor(99.99, "INR"))).toBe(true);
  });
  test("non-finite -> 0", () => {
    expect(toMinor(NaN, "INR")).toBe(0);
  });
  test("round trip", () => {
    expect(toMajor(toMinor(1499.5, "INR"), "INR")).toBe(1499.5);
  });
});

describe("addMinor / computeDueMinor", () => {
  test("integer addition", () => {
    expect(addMinor(100000, 50000, 1)).toBe(150001);
  });
  test("due never negative; overpay clamps to 0", () => {
    expect(computeDueMinor(320000, 320000)).toBe(0);
    expect(computeDueMinor(320000, 400000)).toBe(0);
    expect(computeDueMinor(320000, 100000)).toBe(220000);
  });
});

describe("formatMoney", () => {
  test("formats INR from minor units", () => {
    const s = formatMoney(320000, "INR");
    expect(s).toContain("3,200");
  });
  test("unsupported currency falls back without throwing", () => {
    expect(() => formatMoney(100000, "ZZZ")).not.toThrow();
  });
});
