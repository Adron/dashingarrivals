import { describe, expect, it } from "vitest";
import { formatCountdown, minutesUntil } from "@/lib/time";

const NOW = 1_700_000_000_000;

describe("minutesUntil", () => {
  it("rounds to the nearest minute", () => {
    expect(minutesUntil(NOW + 5 * 60_000, NOW)).toBe(5);
    expect(minutesUntil(NOW + 90_000, NOW)).toBe(2); // 1.5 min rounds to 2
    expect(minutesUntil(NOW - 60_000, NOW)).toBe(-1);
  });
});

describe("formatCountdown", () => {
  it("shows Due for past/imminent and 'N min' otherwise", () => {
    expect(formatCountdown(NOW, NOW)).toBe("Due");
    expect(formatCountdown(NOW - 30_000, NOW)).toBe("Due");
    expect(formatCountdown(NOW + 60_000, NOW)).toBe("1 min");
    expect(formatCountdown(NOW + 12 * 60_000, NOW)).toBe("12 min");
  });
});
