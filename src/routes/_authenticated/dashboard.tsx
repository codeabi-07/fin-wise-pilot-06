import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/categories";
import { ArrowDownRight, ArrowUpRight, Plus, TrendingUp, Wallet, PiggyBank, Activity, Sparkles, Target, Landmark } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Tx = {
  id: string; type: "income" | "expense"; amount: number;
  category: Category; description: string | null; transaction_date: string;
};

function Dashboard() {
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const currency = (profile?.currency ?? "USD") as CurrencyCode;

  const { data: txs = [] } = useQuery<Tx[]>({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions")
        .select("id,type,amount,category,description,transaction_date")
        .order("transaction_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as Tx[];
    },
  });

  const { data: goals = [] } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data } = await supabase.from("savings_goals")
        .select("id,name,target_amount,current_amount,target_date").order("created_at").limit(3);
      return (data ?? []).map((g) => ({ ...g, target_amount: Number(g.target_amount), current_amount: Number(g.current_amount) }));
    },
  });

  const stats = useMemo(() => {
    const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const balance = income - expenses;
    const savings = Math.max(balance, 0);
    const savedInGoals = goals.reduce((s, g) => s + g.current_amount, 0);
    const netWorth = balance + savedInGoals;
    const savingsRate = income > 0 ? savings / income : 0;

    const now = new Date();
    const thisKey = now.toISOString().slice(0, 7);
    const lastD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastKey = lastD.toISOString().slice(0, 7);
    const thisSpend = txs.filter((t) => t.type === "expense" && t.transaction_date.slice(0, 7) === thisKey).reduce((s, t) => s + t.amount, 0);
    const lastSpend = txs.filter((t) => t.type === "expense" && t.transaction_date.slice(0, 7) === lastKey).reduce((s, t) => s + t.amount, 0);
    const trendPct = lastSpend > 0 ? ((thisSpend - lastSpend) / lastSpend) * 100 : 0;

    // Predicted end-of-month based on avg daily this month
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const thisIncome = txs.filter((t) => t.type === "income" && t.transaction_date.slice(0, 7) === thisKey).reduce((s, t) => s + t.amount, 0);
    const projectedNet = thisIncome - (thisSpend / Math.max(dayOfMonth, 1)) * daysInMonth;

    const health = Math.round(Math.min(100, Math.max(0, savingsRate * 100 * 0.6 + (balance > 0 ? 25 : 0) + (goals.length > 0 ? 15 : 0))));
    return { income, expenses, balance, savings, health, netWorth, thisSpend, lastSpend, trendPct, projectedNet };
  }, [txs, goals]);

  const chartData = useMemo(() => {
    const map = new Map<string, { month: string; income: number; expenses: number }>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      map.set(key, { month: d.toLocaleString(undefined, { month: "short" }), income: 0, expenses: 0 });
    }
    txs.forEach((t) => {
      const key = t.transaction_date.slice(0, 7);
      const row = map.get(key);
      if (row) row[t.type === "income" ? "income" : "expenses"] += t.amount;
    });
    return Array.from(map.values());
  }, [txs]);

  const categoryBreakdown = useMemo(() => {
    const now = new Date().toISOString().slice(0, 7);
    const map = new Map<Category, number>();
    txs.filter((t) => t.type === "expense" && t.transaction_date.slice(0, 7) === now)
      .forEach((t) => map.set(t.category, (map.get(t.category) ?? 0) + t.amount));
    return CATEGORIES
      .map((c) => ({ category: c, label: CATEGORY_META[c].label, value: map.get(c) ?? 0, color: CATEGORY_META[c].color }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [txs]);

  const aiInsight = useMemo(() => {
    if (txs.length === 0) return "Add a few transactions and I'll surface spending patterns and savings tips here.";
    const top = categoryBreakdown[0];
    const parts: string[] = [];
    if (top) parts.push(`Your biggest expense this month is **${top.label}** at ${formatMoney(top.value, currency)}.`);
    if (stats.trendPct > 10) parts.push(`Spending is up **${Math.round(stats.trendPct)}%** vs last month — worth a look.`);
    else if (stats.trendPct < -10) parts.push(`Nice — spending is down **${Math.round(Math.abs(stats.trendPct))}%** vs last month.`);
    if (stats.projectedNet > 0) parts.push(`On this trend you'll end the month with **${formatMoney(stats.projectedNet, currency)}** net.`);
    else if (stats.projectedNet < 0) parts.push(`On this trend you'll be **${formatMoney(Math.abs(stats.projectedNet), currency)}** short this month.`);
    return parts.join(" ");
  }, [txs, categoryBreakdown, stats, currency]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Overview</p>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Welcome back{profile?.display_name ? `, ${profile.display_name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Here's your financial pulse at a glance.</p>
        </div>
        <AddTransactionDialog onDone={() => qc.invalidateQueries({ queryKey: ["transactions"] })} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Balance" value={formatMoney(stats.balance, currency)} icon={Wallet} tone="brand" />
        <StatCard label="Net worth" value={formatMoney(stats.netWorth, currency)} icon={Landmark} tone="brand" />
        <StatCard label="Income" value={formatMoney(stats.income, currency)} icon={ArrowDownRight} tone="success" trend="+" />
        <StatCard label="Expenses" value={formatMoney(stats.expenses, currency)} icon={ArrowUpRight} tone="destructive" trend="-" />
        <StatCard
          label="Spend trend"
          value={`${stats.trendPct >= 0 ? "+" : ""}${Math.round(stats.trendPct)}%`}
          icon={TrendingUp}
          tone={stats.trendPct > 10 ? "destructive" : "success"}
        />
      </div>

      {/* AI Insights */}
      <Card className="relative overflow-hidden border-accent/30 shadow-elegant">
        <div className="absolute inset-0 bg-gradient-mesh opacity-60" />
        <CardContent className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-brand text-white shadow-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-display text-sm font-semibold uppercase tracking-wider text-accent">AI Insight</p>
              <Badge variant="outline" className="text-[10px]">Live</Badge>
            </div>
            <p className="mt-1 text-sm text-foreground/90">
              {aiInsight.split(/\*\*(.*?)\*\*/g).map((chunk, i) => i % 2 === 1
                ? <span key={i} className="font-semibold text-foreground">{chunk}</span>
                : <span key={i}>{chunk}</span>)}
            </p>
          </div>
          <Button asChild variant="outline" className="shrink-0 backdrop-blur">
            <Link to="/assistant"><Sparkles className="mr-2 h-4 w-4" /> Ask coach</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-accent" /> Monthly cashflow</CardTitle>
            <CardDescription>Last 6 months of income and expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-5)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="var(--color-chart-5)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      color: "var(--color-popover-foreground)",
                    }}
                    formatter={(v: number) => formatMoney(v, currency)}
                  />
                  <Area type="monotone" dataKey="income" stroke="var(--color-chart-2)" fill="url(#inc)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expenses" stroke="var(--color-chart-5)" fill="url(#exp)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4 text-accent" /> Financial health</CardTitle>
            <CardDescription>Based on your savings rate & balance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="relative flex items-center justify-center">
              <svg viewBox="0 0 120 120" className="h-40 w-40 -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-muted)" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="52" fill="none" stroke="url(#healthGrad)"
                  strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${(stats.health / 100) * 326.7} 326.7`}
                />
                <defs>
                  <linearGradient id="healthGrad">
                    <stop offset="0%" stopColor="var(--color-chart-1)" />
                    <stop offset="100%" stopColor="var(--color-chart-2)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute text-center">
                <div className="font-display text-4xl font-bold">{stats.health}</div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">out of 100</div>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Savings rate</span>
                <span className="font-medium">
                  {stats.income > 0 ? Math.round((stats.savings / stats.income) * 100) : 0}%
                </span>
              </div>
              <Progress value={stats.income > 0 ? (stats.savings / stats.income) * 100 : 0} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown + Goals */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PiggyBank className="h-4 w-4 text-accent" /> Category breakdown</CardTitle>
            <CardDescription>Where your money went this month</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No expenses yet this month.</div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-center">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryBreakdown} dataKey="value" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2}>
                        {categoryBreakdown.map((c) => <Cell key={c.category} fill={c.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12 }}
                        formatter={(v: number) => formatMoney(v, currency)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {categoryBreakdown.slice(0, 5).map((c) => {
                    const total = categoryBreakdown.reduce((s, r) => s + r.value, 0);
                    const pct = total > 0 ? (c.value / total) * 100 : 0;
                    return (
                      <div key={c.category} className="flex items-center gap-3">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                        <span className="flex-1 text-sm">{c.label}</span>
                        <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
                        <span className="w-24 text-right text-sm font-medium">{formatMoney(c.value, currency)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-elegant">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Target className="h-4 w-4 text-accent" /> Savings goals</CardTitle>
              <CardDescription>Top {Math.min(3, goals.length || 3)} goals</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm"><Link to="/budgets">Manage</Link></Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {goals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No goals yet. <Link to="/budgets" className="text-accent underline">Create one</Link> to start tracking.
              </div>
            ) : goals.map((g) => {
              const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
              return (
                <div key={g.id}>
                  <div className="flex justify-between text-sm">
                    <span className="truncate font-medium">{g.name}</span>
                    <span className="text-muted-foreground">{Math.round(pct)}%</span>
                  </div>
                  <Progress value={pct} className="mt-1.5" />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>{formatMoney(g.current_amount, currency)}</span>
                    <span>{formatMoney(g.target_amount, currency)}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
          <CardDescription>Your latest {Math.min(6, txs.length)} entries</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {txs.slice(0, 6).map((t) => {
            const meta = CATEGORY_META[t.category];
            const Icon = meta.icon;
            return (
              <div key={t.id} className="flex items-center gap-4 py-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${meta.color}20`, color: meta.color }}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.description || meta.label}</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.transaction_date).toLocaleDateString()} · {meta.label}</div>
                </div>
                <div className={`text-sm font-semibold ${t.type === "income" ? "text-[var(--color-success)]" : "text-[var(--color-destructive)]"}`}>
                  {t.type === "income" ? "+" : "-"}{formatMoney(t.amount, currency)}
                </div>
              </div>
            );
          })}
          {txs.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No transactions yet — add your first one to see insights.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, tone, trend,
}: { label: string; value: string; icon: React.ElementType; tone: "brand" | "success" | "destructive" | "accent"; trend?: string }) {
  const toneMap = {
    brand: "from-[color:var(--color-primary)] to-[color:var(--color-chart-3)]",
    success: "from-[color:var(--color-chart-2)] to-[color:var(--color-chart-1)]",
    destructive: "from-[color:var(--color-chart-5)] to-[color:var(--color-chart-4)]",
    accent: "from-[color:var(--color-accent)] to-[color:var(--color-chart-1)]",
  } as const;
  return (
    <Card className="relative overflow-hidden shadow-elegant">
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${toneMap[tone]} opacity-20 blur-2xl`} />
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <div className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${toneMap[tone]} text-white`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 font-display text-2xl font-bold tracking-tight">
          {trend}{value}
        </div>
      </CardContent>
    </Card>
  );
}

export function AddTransactionDialog({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("food");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const mutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(amount);
      if (!amt || amt <= 0) throw new Error("Enter a valid amount");
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const { error } = await supabase.from("transactions").insert({
        user_id: userData.user.id,
        type, amount: amt, category, description: description || null, transaction_date: date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transaction added");
      setOpen(false);
      setAmount(""); setDescription("");
      onDone?.();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-brand text-white hover:opacity-90 shadow-glow">
          <Plus className="mr-2 h-4 w-4" /> Add transaction
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New transaction</DialogTitle>
          <DialogDescription>Log income or an expense in a few seconds.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={type === "expense" ? "default" : "outline"} onClick={() => setType("expense")} className={type === "expense" ? "bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)] hover:opacity-90" : ""}>
              <ArrowUpRight className="mr-2 h-4 w-4" /> Expense
            </Button>
            <Button type="button" variant={type === "income" ? "default" : "outline"} onClick={() => setType("income")} className={type === "income" ? "bg-[var(--color-success)] text-[var(--color-success-foreground)] hover:opacity-90" : ""}>
              <ArrowDownRight className="mr-2 h-4 w-4" /> Income
            </Button>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="amt">Amount</Label>
            <Input id="amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="grid gap-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_META[c].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dt">Date</Label>
            <Input id="dt" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="desc">Note (optional)</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Coffee with team" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="bg-gradient-brand text-white hover:opacity-90">
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Re-export helpers to satisfy tree-shaking clarity
export { Badge };
