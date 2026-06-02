/**
 * Analytics aggregation tests — prove the rollup is fully DERIVED from the
 * immutable membership records (no independent financial source of truth).
 */
import { describe, test, expect } from "vitest";
import {
  aggregateMemberships,
  buildMonthlySeries,
  lastNMonthKeys,
  renewalRate,
  monthKeyOf,
  monthShortLabel,
  type AggMembershipInput,
} from "../src/lib/domain/analytics.logic";

const ms = (
  member_id: string,
  created_at: string,
  amount_paid_minor: number,
  joining_fee_minor = 0,
  discount_minor = 0,
): AggMembershipInput => ({ member_id, created_at, amount_paid_minor, joining_fee_minor, discount_minor });

describe("aggregateMemberships", () => {
  test("sums revenue per month from membership records", () => {
    const data = [
      ms("a", "2026-05-10T00:00:00Z", 300000),
      ms("b", "2026-05-20T00:00:00Z", 500000),
      ms("a", "2026-06-10T00:00:00Z", 300000), // renewal next month
    ];
    const map = aggregateMemberships(data);
    expect(map.get("2026-05")!.revenue_collected_minor).toBe(800000);
    expect(map.get("2026-06")!.revenue_collected_minor).toBe(300000);
  });

  test("counts new joins as the FIRST period per member only", () => {
    const data = [
      ms("a", "2026-05-10T00:00:00Z", 300000), // a joins
      ms("a", "2026-06-10T00:00:00Z", 300000), // a renews (not a join)
      ms("b", "2026-06-12T00:00:00Z", 300000), // b joins
    ];
    const map = aggregateMemberships(data);
    expect(map.get("2026-05")!.new_joins_count).toBe(1);
    expect(map.get("2026-06")!.new_joins_count).toBe(1); // only b
    expect(map.get("2026-06")!.periods_count).toBe(2);
  });

  test("tracks joining fees and discounts separately", () => {
    const data = [ms("a", "2026-06-01T00:00:00Z", 380000, 100000, 20000)];
    const m = aggregateMemberships(data).get("2026-06")!;
    expect(m.joining_fees_minor).toBe(100000);
    expect(m.discount_minor).toBe(20000);
    expect(m.revenue_collected_minor).toBe(380000);
  });

  test("join detection is order-independent (sorts by created_at)", () => {
    const unordered = [
      ms("a", "2026-06-10T00:00:00Z", 300000), // later (renewal)
      ms("a", "2026-05-10T00:00:00Z", 300000), // earlier (join)
    ];
    const map = aggregateMemberships(unordered);
    expect(map.get("2026-05")!.new_joins_count).toBe(1);
    expect(map.get("2026-06")!.new_joins_count).toBe(0);
  });

  test("empty input yields empty map", () => {
    expect(aggregateMemberships([]).size).toBe(0);
  });
});

describe("lastNMonthKeys", () => {
  test("returns N continuous keys ending at today, oldest first", () => {
    const keys = lastNMonthKeys("2026-06-15T00:00:00Z", 3);
    expect(keys).toEqual(["2026-04", "2026-05", "2026-06"]);
  });
  test("wraps across year boundary", () => {
    const keys = lastNMonthKeys("2026-02-01T00:00:00Z", 3);
    expect(keys).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
});

describe("buildMonthlySeries", () => {
  test("fills gaps with zeros for a continuous chart", () => {
    const map = aggregateMemberships([ms("a", "2026-06-01T00:00:00Z", 300000)]);
    const series = buildMonthlySeries(map, ["2026-05", "2026-06"]);
    expect(series).toHaveLength(2);
    expect(series[0].revenue_collected_minor).toBe(0); // May filled
    expect(series[1].revenue_collected_minor).toBe(300000);
  });
});

describe("renewalRate", () => {
  test("renewals / total periods as a percentage", () => {
    // 4 periods, 1 join => 3 renewals => 75%
    const map = aggregateMemberships([
      ms("a", "2026-05-01T00:00:00Z", 1),
      ms("a", "2026-06-01T00:00:00Z", 1),
      ms("a", "2026-07-01T00:00:00Z", 1),
      ms("a", "2026-08-01T00:00:00Z", 1),
    ]);
    const series = buildMonthlySeries(map, lastNMonthKeys("2026-08-01T00:00:00Z", 6));
    expect(renewalRate(series)).toBe(75);
  });
  test("zero periods => 0%", () => {
    expect(renewalRate([])).toBe(0);
  });
});

describe("helpers", () => {
  test("monthKeyOf extracts YYYY-MM", () => {
    expect(monthKeyOf("2026-06-15T10:30:00Z")).toBe("2026-06");
  });
  test("monthShortLabel maps month number", () => {
    expect(monthShortLabel("2026-06")).toBe("Jun");
    expect(monthShortLabel("2026-12")).toBe("Dec");
  });
});
