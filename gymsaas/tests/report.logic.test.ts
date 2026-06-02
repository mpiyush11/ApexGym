/** Report logic + CSV-injection unit tests (no emulator). */
import { describe, test, expect } from "vitest";
import { weeklyPeriod, reportIdForPeriodEnd, inPeriod } from "../src/lib/domain/report.logic";
import { csvCell, csvRow } from "../src/lib/utils/csv";

describe("weeklyPeriod", () => {
  test("7-day window ending today (UTC-midnight anchors)", () => {
    const { start, end } = weeklyPeriod("2026-06-15T10:30:00.000Z");
    expect(end).toBe("2026-06-15T00:00:00.000Z");
    expect(start).toBe("2026-06-08T00:00:00.000Z");
  });
});

describe("reportIdForPeriodEnd", () => {
  test("stable, date-keyed id (idempotent per day)", () => {
    expect(reportIdForPeriodEnd("2026-06-15T00:00:00.000Z")).toBe("report-2026-06-15");
  });
});

describe("inPeriod", () => {
  const start = "2026-06-08T00:00:00.000Z";
  const end = "2026-06-15T00:00:00.000Z";
  test("includes start, excludes end", () => {
    expect(inPeriod("2026-06-08T00:00:00.000Z", start, end)).toBe(true);
    expect(inPeriod("2026-06-14T23:59:59.000Z", start, end)).toBe(true);
    expect(inPeriod("2026-06-15T00:00:00.000Z", start, end)).toBe(false);
    expect(inPeriod("2026-06-07T23:59:59.000Z", start, end)).toBe(false);
  });
});

describe("CSV injection protection", () => {
  test("neutralizes formula-trigger leading characters", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+44 79")).toBe("'+44 79");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });
  test("quotes values with comma/quote/newline (RFC-4180)", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""');
  });
  test("plain values pass through", () => {
    expect(csvCell("Aarav")).toBe("Aarav");
    expect(csvCell(3200)).toBe("3200");
    expect(csvCell(null)).toBe("");
  });
  test("csvRow joins + terminates with CRLF", () => {
    expect(csvRow(["a", "b,c", "=x"])).toBe('a,"b,c",\'=x\r\n');
  });
});
