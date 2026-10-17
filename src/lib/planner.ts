// Pure money-planning formulas. Keep free of React/DB so they stay testable.
const DAY = 86_400_000;

export function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / DAY));
}

export function requiredPerPeriod(remaining: number, now: Date, targetDate: Date | null) {
  if (remaining <= 0) return { perDay: 0, perWeek: 0, perMonth: 0, daysLeft: 0 };
  if (!targetDate) return null;
  const daysLeft = Math.max(1, daysBetween(now, targetDate));
  const perDay = remaining / daysLeft;
  return { perDay, perWeek: perDay * 7, perMonth: perDay * 30.44, daysLeft };
}

export function nextSalaryDate(now: Date, salaryDay: number | null | undefined) {
  const day = salaryDay && salaryDay >= 1 && salaryDay <= 31 ? salaryDay : 1;
  const clamp = (y: number, m: number) => Math.min(day, new Date(y, m + 1, 0).getDate());
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), clamp(now.getFullYear(), now.getMonth()));
  if (thisMonth.getTime() > startOfDay(now).getTime()) return thisMonth;
  const y = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const m = (now.getMonth() + 1) % 12;
  return new Date(y, m, clamp(y, m));
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Money free to spend this cycle after reserving goal savings. */
export function safeToSpend(monthlyIncome: number, goalSavingsPerMonth: number, spentThisCycle: number) {
  return monthlyIncome - goalSavingsPerMonth - spentThisCycle;
}

export function dailyAllowance(safe: number, daysLeft: number) {
  if (safe <= 0) return 0;
  return safe / Math.max(1, daysLeft);
}

/** Estimated finish date at a given monthly saving pace. */
export function projectedCompletion(remaining: number, monthlyPace: number, now: Date) {
  if (remaining <= 0) return now;
  if (monthlyPace <= 0) return null;
  const days = Math.ceil((remaining / monthlyPace) * 30.44);
  return new Date(now.getTime() + days * DAY);
}

export type GoalStatus = "done" | "ahead" | "on-track" | "behind" | "no-date";
export function goalStatus(remaining: number, requiredMonthly: number | null, actualMonthlyPace: number): GoalStatus {
  if (remaining <= 0) return "done";
  if (requiredMonthly == null) return "no-date";
  if (actualMonthlyPace >= requiredMonthly * 1.1) return "ahead";
  if (actualMonthlyPace >= requiredMonthly * 0.9) return "on-track";
  return "behind";
}

export function walletBalance(
  opening: number,
  txs: { type: string; amount: number }[],
  contributions: { amount: number }[],
) {
  const inc = txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const exp = txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const moved = contributions.reduce((s, c) => s + c.amount, 0);
  return opening + inc - exp - moved;
}
