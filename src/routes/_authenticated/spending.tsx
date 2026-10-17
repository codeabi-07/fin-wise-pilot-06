import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, PieChart, Pie, Cell } from "recharts";
import { formatMoney } from "@/lib/currency";
import { CATEGORY_META, type Category } from "@/lib/categories";
import { useFinance } from "@/hooks/use-finance";
import { ChevronDown, Search, Tag, TrendingDown, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/spending")({
  head: () => ({ meta: [
    { title: "Spending · FinPilot AI" },
    { name: "description", content: "See how much you spent, on what, and why — by category and purpose." },
    { property: "og:title", content: "Spending · FinPilot AI" },
    { property: "og:description", content: "Where your money went and why." },
  ] }),
  component: SpendingPage,
});

type Period = "week" | "month" | "last" | "custom";
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function range(p: Period, from: string, to: string) {
  const n = new Date();
  if (p === "week") { const s = new Date(n); s.setDate(n.getDate() - 6); return [iso(s), iso(n)]; }
  if (p === "last") return [iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), iso(new Date(n.getFullYear(), n.getMonth(), 0))];
  if (p === "custom" && from && to) return [from, to];
  return [iso(new Date(n.getFullYear(), n.getMonth(), 1)), iso(n)];
}

function SpendingPage() {
  const f = useFinance();
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Category | null>(null);
  const [start, end] = range(period, from, to);

  const data = useMemo(() => {
    const inRange = f.txs.filter((t) => t.transaction_date >= start && t.transaction_date <= end && t.purpose !== "Balance adjustment");
    const exp = inRange.filter((t) => t.type === "expense");
    const spent = exp.reduce((s, t) => s + t.amount, 0);
    const income = inRange.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const len = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
    const ps = new Date(start); ps.setDate(ps.getDate() - len); const pe = new Date(start); pe.setDate(pe.getDate() - 1);
    const prevSpent = f.txs.filter((t) => t.type === "expense" && t.transaction_date >= iso(ps) && t.transaction_date <= iso(pe)).reduce((s, t) => s + t.amount, 0);
    const byCat = new Map<Category, typeof exp>();
    exp.forEach((t) => byCat.set(t.category, [...(byCat.get(t.category) ?? []), t]));
    const cats = [...byCat.entries()].map(([c, items]) => ({ c, items, total: items.reduce((s, t) => s + t.amount, 0), color: CATEGORY_META[c].color, label: CATEGORY_META[c].label })).sort((a, b) => b.total - a.total);
    const byPurpose = new Map<string, number>();
    exp.forEach((t) => { const k = (t.purpose || t.description || "").trim(); if (k) byPurpose.set(k, (byPurpose.get(k) ?? 0) + t.amount); });
    const purposes = [...byPurpose.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const daily = new Map<string, number>();
    for (let i = 0; i < Math.min(len, 62); i++) { const d = new Date(start); d.setDate(d.getDate() + i); daily.set(iso(d), 0); }
    exp.forEach((t) => daily.has(t.transaction_date) && daily.set(t.transaction_date, daily.get(t.transaction_date)! + t.amount));
    const dailyArr = [...daily.entries()].map(([d, v]) => ({ d: d.slice(8), v }));
    const biggest = [...exp].sort((a, b) => b.amount - a.amount).slice(0, 5);
    return { spent, income, prevSpent, cats, purposes, dailyArr, biggest, exp };
  }, [f.txs, start, end]);

  const pctOfMoney = f.totalOnHand + data.spent > 0 ? (data.spent / (f.totalOnHand + data.spent)) * 100 : 0;
  const change = data.prevSpent > 0 ? ((data.spent - data.prevSpent) / data.prevSpent) * 100 : 0;
  const searchHits = q ? data.exp.filter((t) => `${t.description ?? ""} ${t.purpose ?? ""}`.toLowerCase().includes(q.toLowerCase())) : [];
  const m = (v: number) => formatMoney(v, f.currency);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Insights</p>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Spending</h1>
          <p className="mt-1 text-sm text-muted-foreground">How much you spent, on what, and why.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="last">Last month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {period === "custom" && <>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </>}
        </div>
      </div>

      <Card className="relative overflow-hidden shadow-elegant">
        <div className="absolute inset-0 bg-gradient-mesh opacity-60" />
        <CardContent className="relative grid gap-6 p-6 md:grid-cols-3">
          <div><p className="text-xs uppercase tracking-wider text-muted-foreground">You spent</p><div className="font-display text-3xl font-bold">{m(data.spent)}</div>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">{change > 0 ? <TrendingUp className="h-3 w-3 text-destructive" /> : <TrendingDown className="h-3 w-3 text-success" />}{Math.abs(Math.round(change))}% vs previous period</p></div>
          <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Money with you now</p><div className="font-display text-3xl font-bold">{m(f.totalOnHand)}</div>
            <p className="mt-1 text-xs text-muted-foreground">You've used {Math.round(pctOfMoney)}% of your money this period</p></div>
          <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Income in period</p><div className="font-display text-3xl font-bold">{m(data.income)}</div></div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-elegant">
          <CardHeader><CardTitle>By category</CardTitle><CardDescription>Tap a category to see each item</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {data.cats.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No spending in this period.</p>}
            {data.cats.map((c) => (
              <div key={c.c} className="rounded-xl border border-border">
                <button onClick={() => setOpen(open === c.c ? null : c.c)} className="flex w-full items-center gap-3 p-3 text-left">
                  <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                  <span className="flex-1 text-sm font-medium">{c.label}</span>
                  <span className="text-xs text-muted-foreground">{data.spent ? Math.round((c.total / data.spent) * 100) : 0}%</span>
                  <span className="w-28 text-right text-sm font-semibold tabular-nums">{m(c.total)}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${open === c.c ? "rotate-180" : ""}`} />
                </button>
                {open === c.c && <div className="divide-y divide-border border-t border-border">
                  {c.items.map((t) => <Row key={t.id} t={t} m={m} />)}
                </div>}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="shadow-elegant">
          <CardHeader><CardTitle>Share</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={data.cats} dataKey="total" nameKey="label" innerRadius={50} outerRadius={85} paddingAngle={2}>
                {data.cats.map((c) => <Cell key={c.c} fill={c.color} />)}
              </Pie><Tooltip formatter={(v: number) => m(v)} contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12 }} /></PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-elegant">
          <CardHeader><CardTitle>Daily spending</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dailyArr}><XAxis dataKey="d" fontSize={11} stroke="var(--color-muted-foreground)" />
                <Tooltip formatter={(v: number) => m(v)} contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                <Bar dataKey="v" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="shadow-elegant">
          <CardHeader><CardTitle className="flex items-center gap-2"><Tag className="h-4 w-4 text-accent" /> Top purposes</CardTitle><CardDescription>What you spent for</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {data.purposes.length === 0 && <p className="text-sm text-muted-foreground">Add a purpose when logging expenses to see this.</p>}
            {data.purposes.map(([p, v]) => <div key={p} className="flex justify-between gap-2 text-sm"><span className="truncate">{p}</span><span className="font-medium tabular-nums">{m(v)}</span></div>)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-elegant">
          <CardHeader><CardTitle>Biggest expenses</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border p-0">{data.biggest.map((t) => <Row key={t.id} t={t} m={m} />)}</CardContent>
        </Card>
        <Card className="shadow-elegant">
          <CardHeader><CardTitle>Search notes & purposes</CardTitle>
            <div className="relative mt-2"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. trip, rent, coffee" className="pl-9" /></div>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {q && <div className="px-6 py-2 text-xs text-muted-foreground">{searchHits.length} items · {m(searchHits.reduce((s, t) => s + t.amount, 0))}</div>}
            {searchHits.slice(0, 20).map((t) => <Row key={t.id} t={t} m={m} />)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ t, m }: { t: { description: string | null; purpose: string | null; transaction_date: string; amount: number; category: Category }; m: (v: number) => string }) {
  return (
    <div className="flex items-center gap-3 px-6 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{t.description || CATEGORY_META[t.category].label}</div>
        <div className="text-xs text-muted-foreground">{new Date(t.transaction_date).toLocaleDateString()}{t.purpose ? ` · ${t.purpose}` : ""}</div>
      </div>
      <div className="text-sm font-semibold tabular-nums">{m(t.amount)}</div>
    </div>
  );
}
