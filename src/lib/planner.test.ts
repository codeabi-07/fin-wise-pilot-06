import { describe, it, expect } from "vitest";
import { requiredPerPeriod, safeToSpend, dailyAllowance, projectedCompletion, goalStatus, walletBalance, nextSalaryDate } from "./planner";

const now = new Date(2026, 0, 1);

describe("planner", () => {
  it("required savings = remaining / days left", () => {
    const r = requiredPerPeriod(1000, now, new Date(2026, 0, 11))!;
    expect(r.daysLeft).toBe(10);
    expect(r.perDay).toBe(100);
    expect(r.perWeek).toBe(700);
  });
  it("no target date gives no requirement", () => {
    expect(requiredPerPeriod(1000, now, null)).toBeNull();
  });
  it("safe to spend = income - goal savings - spent", () => {
    expect(safeToSpend(50000, 10000, 15000)).toBe(25000);
  });
  it("daily allowance divides safe money by days left, never negative", () => {
    expect(dailyAllowance(3000, 10)).toBe(300);
    expect(dailyAllowance(-50, 10)).toBe(0);
  });
  it("projected completion uses monthly pace", () => {
    expect(projectedCompletion(1000, 0, now)).toBeNull();
    const d = projectedCompletion(1000, 1000, now)!;
    expect(Math.round((d.getTime() - now.getTime()) / 86400000)).toBe(31);
  });
  it("status thresholds", () => {
    expect(goalStatus(100, 100, 120)).toBe("ahead");
    expect(goalStatus(100, 100, 95)).toBe("on-track");
    expect(goalStatus(100, 100, 50)).toBe("behind");
    expect(goalStatus(0, 100, 0)).toBe("done");
  });
  it("wallet balance = opening + income - expenses - goal transfers", () => {
    expect(walletBalance(1000, [{ type: "income", amount: 500 }, { type: "expense", amount: 200 }], [{ amount: 100 }])).toBe(1200);
  });
  it("next salary date rolls to next month once passed", () => {
    expect(nextSalaryDate(new Date(2026, 0, 20), 5).getMonth()).toBe(1);
    expect(nextSalaryDate(new Date(2026, 0, 2), 5).getDate()).toBe(5);
  });
});
