import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/categories";
import type { CurrencyCode } from "@/lib/currency";
import {
  walletBalance, requiredPerPeriod, nextSalaryDate, safeToSpend, dailyAllowance,
  projectedCompletion, goalStatus, daysBetween, type GoalStatus,
} from "@/lib/planner";

export type FullTx = {
  id: string; type: "income" | "expense"; amount: number; category: Category;
  description: string | null; purpose: string | null; transaction_date: string; wallet_id: string | null;
};
export type WalletRow = { id: string; name: string; kind: string; opening_balance: number };
export type Contribution = { id: string; goal_id: string; wallet_id: string | null; amount: number; contributed_on: string };
export type GoalRow = { id: string; name: string; target_amount: number; current_amount: number; target_date: string | null; created_at: string };

export const FIN_KEYS = [["tx-full"], ["wallets"], ["contributions"], ["goals"], ["goals-full"], ["transactions"], ["profile"]];

export function useInvalidateFinance() {
  const qc = useQueryClient();
  return () => FIN_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
}

export function useFinance() {
  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await supabase.from("profiles").select("*").maybeSingle()).data,
  });
  const txQ = useQuery<FullTx[]>({
    queryKey: ["tx-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions")
        .select("id,type,amount,category,description,purpose,transaction_date,wallet_id")
        .order("transaction_date", { ascending: false }).limit(2000);
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as FullTx[];
    },
  });
  const walletsQ = useQuery<WalletRow[]>({
    queryKey: ["wallets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wallets").select("id,name,kind,opening_balance").order("created_at");
      if (error) throw error;
      return (data ?? []).map((w) => ({ ...w, opening_balance: Number(w.opening_balance) }));
    },
  });
  const contribQ = useQuery<Contribution[]>({
    queryKey: ["contributions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goal_contributions").select("id,goal_id,wallet_id,amount,contributed_on");
      if (error) throw error;
      return (data ?? []).map((c) => ({ ...c, amount: Number(c.amount) }));
    },
  });
  const goalsQ = useQuery<GoalRow[]>({
    queryKey: ["goals-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("savings_goals").select("id,name,target_amount,current_amount,target_date,created_at").order("created_at");
      if (error) throw error;
      return (data ?? []).map((g) => ({ ...g, target_amount: Number(g.target_amount), current_amount: Number(g.current_amount) }));
    },
  });

  const profile = profileQ.data;
  const currency = (profile?.currency ?? "USD") as CurrencyCode;
  const txs = txQ.data ?? [];
  const wallets = walletsQ.data ?? [];
  const contributions = contribQ.data ?? [];
  const goals = goalsQ.data ?? [];

  const derived = useMemo(() => {
    const now = new Date();
    const firstWallet = wallets[0]?.id ?? null;
    const walletBalances = wallets.map((w) => {
      const own = txs.filter((t) => (t.wallet_id ?? firstWallet) === w.id);
      const own_c = contributions.filter((c) => (c.wallet_id ?? firstWallet) === w.id);
      return { ...w, balance: walletBalance(w.opening_balance, own, own_c) };
    });
    const totalOnHand = wallets.length
      ? walletBalances.reduce((s, w) => s + w.balance, 0)
      : walletBalance(0, txs, contributions);

    // Salary cycle
    const salaryDay = profile?.salary_day ?? 1;
    const nextPay = nextSalaryDate(now, salaryDay);
    const cycleStart = new Date(nextPay.getFullYear(), nextPay.getMonth() - 1, Math.min(salaryDay, new Date(nextPay.getFullYear(), nextPay.getMonth(), 0).getDate()));
    const daysToPay = Math.max(1, daysBetween(now, nextPay));
    const cycleKey = cycleStart.toISOString().slice(0, 10);
    const spentThisCycle = txs.filter((t) => t.type === "expense" && t.transaction_date >= cycleKey).reduce((s, t) => s + t.amount, 0);
    const incomeThisCycle = txs.filter((t) => t.type === "income" && t.transaction_date >= cycleKey).reduce((s, t) => s + t.amount, 0);
    const monthlyIncome = Number(profile?.monthly_income ?? 0) || incomeThisCycle;

    const goalPlans = goals.map((g) => {
      const saved = g.current_amount;
      const remaining = Math.max(0, g.target_amount - saved);
      const req = requiredPerPeriod(remaining, now, g.target_date ? new Date(g.target_date) : null);
      const gc = contributions.filter((c) => c.goal_id === g.id);
      const since = new Date(g.created_at);
      const monthsActive = Math.max(1, daysBetween(since, now) / 30.44);
      const pace = gc.reduce((s, c) => s + c.amount, 0) / monthsActive;
      const status: GoalStatus = goalStatus(remaining, req?.perMonth ?? null, pace);
      return { ...g, saved, remaining, req, pace, status, eta: projectedCompletion(remaining, req ? Math.max(pace, 0) : pace, now) };
    });
    const goalMonthly = goalPlans.reduce((s, g) => s + (g.req?.perMonth ?? 0), 0);
    const safe = safeToSpend(monthlyIncome, goalMonthly, spentThisCycle);
    const perDay = dailyAllowance(safe, daysToPay);

    return { walletBalances, totalOnHand, nextPay, daysToPay, spentThisCycle, monthlyIncome, goalPlans, goalMonthly, safe, perDay };
  }, [txs, wallets, contributions, goals, profile]);

  return { profile, currency, txs, wallets, contributions, goals, loading: txQ.isLoading, ...derived };
}
