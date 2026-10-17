# FinPilot AI: Money on hand, where it went, and goal planning

## 1. "Money with me now" (wallets)
- New **Wallets** section: add places where money sits (Cash, Bank, Card, UPI/e-wallet), each with a starting balance.
- Each income/expense is tied to a wallet (default wallet chosen automatically).
- Live balance per wallet = starting balance + income − expenses. A **Total money with me** figure goes at the top of the dashboard.
- "Adjust balance" button so the user can type the real amount they have now. The app records the difference as an adjustment, so history stays correct.

## 2. "What did I spend on, and why" (Spending page)
- New **Spending** page with a period picker: This week, This month, Last month, Custom.
- Headline: "You had X, spent Y (Z%), Y left."
- Category breakdown (donut and ranked list), each category expandable to the individual items and notes (the "purpose").
- Optional **purpose/tag** field on each expense (e.g. "college trip", "rent"), plus a "Top purposes" list.
- Daily spending bar chart, biggest single expenses, and a comparison with the previous period.
- Notes are searchable.

## 3. Goal planner ("how much to save or spend")
For each savings goal with a target date:
- **Save per month / per week / per day** needed = remaining amount ÷ time left.
- **Safe-to-spend this month** = monthly income − planned savings for all goals − budgets already used for bills.
- **Daily spending allowance** = safe-to-spend remaining ÷ days left until the next salary date.
- Status: On track / Behind / Ahead, based on the current savings pace, with a projected finish date.
- "Add money to goal" button that moves money from a wallet into the goal.
- Goals without a date: the app suggests a date based on the current savings rate.
- A dashboard card: "To hit your goals, save ₹X this month. You can spend ₹Y/day."
- The AI Coach gets these numbers so it can give specific advice like "cut Food by ₹2,000 to stay on track."

## Technical details
- Migration: `wallets` table (id, user_id, name, type, opening_balance, created_at) with RLS and grants; `transactions.wallet_id` (nullable, plus a backfill to a default "Cash" wallet per user) and `transactions.purpose` text; new type `adjustment` (or an adjustment category); `goal_contributions` table (goal_id, wallet_id, amount, date); `profiles.monthly_income` and `salary_day` if they don't already exist.
- Shared calculation module `src/lib/planner.ts` (pure functions: requiredPerPeriod, safeToSpend, dailyAllowance, projectedCompletion), with vitest tests for the formulas.
- New routes: `_authenticated/wallets.tsx` and `_authenticated/spending.tsx`; goal planner UI on the budgets/goals page; dashboard cards; nav links in the app shell.
- Update the Add Transaction dialog with wallet and purpose fields.
- Extend the AI Coach context with wallet balances and goal planner output.
