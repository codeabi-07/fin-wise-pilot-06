import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/categories";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/budgets")({
  component: BudgetsPage,
});

type Budget = { id: string; category: Category; monthly_limit: number; month: string };
type Goal = { id: string; name: string; target_amount: number; current_amount: number; target_date: string | null };
type Tx = { type: "income" | "expense"; amount: number; category: Category; transaction_date: string };

function monthStart() {
  const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function BudgetsPage() {
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await supabase.from("profiles").select("*").maybeSingle()).data,
  });
  const currency = (profile?.currency ?? "USD") as CurrencyCode;

  const { data: budgets = [] } = useQuery<Budget[]>({
    queryKey: ["budgets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("budgets").select("id,category,monthly_limit,month").eq("month", monthStart());
      if (error) throw error;
      return (data ?? []).map((b) => ({ ...b, monthly_limit: Number(b.monthly_limit) })) as Budget[];
    },
  });

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("savings_goals").select("id,name,target_amount,current_amount,target_date").order("created_at");
      if (error) throw error;
      return (data ?? []).map((g) => ({ ...g, target_amount: Number(g.target_amount), current_amount: Number(g.current_amount) })) as Goal[];
    },
  });

  const { data: txs = [] } = useQuery<Tx[]>({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("type,amount,category,transaction_date");
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as Tx[];
    },
  });

  const spentByCategory = useMemo(() => {
    const map = new Map<Category, number>();
    const cur = monthStart();
    txs.forEach((t) => {
      if (t.type !== "expense") return;
      if (t.transaction_date.slice(0, 7) !== cur.slice(0, 7)) return;
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    });
    return map;
  }, [txs]);

  const delBudget = useMutation({
    mutationFn: async (id: string) => (await supabase.from("budgets").delete().eq("id", id)).error,
    onSuccess: () => { toast.success("Budget removed"); qc.invalidateQueries({ queryKey: ["budgets"] }); },
  });
  const delGoal = useMutation({
    mutationFn: async (id: string) => (await supabase.from("savings_goals").delete().eq("id", id)).error,
    onSuccess: () => { toast.success("Goal removed"); qc.invalidateQueries({ queryKey: ["goals"] }); },
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Plan</p>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Budgets & goals</h1>
        <p className="mt-1 text-sm text-muted-foreground">Set monthly limits and track savings targets.</p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">This month's budgets</h2>
          <NewBudgetDialog onDone={() => qc.invalidateQueries({ queryKey: ["budgets"] })} existing={budgets.map((b) => b.category)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {budgets.map((b) => {
            const spent = spentByCategory.get(b.category) ?? 0;
            const pct = b.monthly_limit > 0 ? Math.min(100, (spent / b.monthly_limit) * 100) : 0;
            const over = spent > b.monthly_limit;
            const meta = CATEGORY_META[b.category];
            const Icon = meta.icon;
            return (
              <Card key={b.id} className="shadow-elegant">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${meta.color}20`, color: meta.color }}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{meta.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatMoney(spent, currency)} of {formatMoney(b.monthly_limit, currency)}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => delBudget.mutate(b.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <Progress value={pct} className={`mt-4 ${over ? "[&>div]:bg-[var(--color-destructive)]" : ""}`} />
                  <div className="mt-2 flex justify-between text-xs">
                    <span className={over ? "text-[var(--color-destructive)] font-medium" : "text-muted-foreground"}>
                      {over ? `Over by ${formatMoney(spent - b.monthly_limit, currency)}` : `${Math.round(100 - pct)}% left`}
                    </span>
                    <span className="text-muted-foreground">{Math.round(pct)}%</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {budgets.length === 0 && (
            <Card className="md:col-span-2"><CardContent className="p-10 text-center text-sm text-muted-foreground">No budgets yet. Add one to start tracking.</CardContent></Card>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Savings goals</h2>
          <NewGoalDialog onDone={() => qc.invalidateQueries({ queryKey: ["goals"] })} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0;
            return (
              <Card key={g.id} className="shadow-elegant">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-white">
                      <Target className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{g.name}</CardTitle>
                      {g.target_date && <CardDescription>By {new Date(g.target_date).toLocaleDateString()}</CardDescription>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => delGoal.mutate(g.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={pct} />
                  <div className="mt-2 flex justify-between text-xs">
                    <span className="text-muted-foreground">{formatMoney(g.current_amount, currency)} saved</span>
                    <span className="font-medium">{formatMoney(g.target_amount, currency)}</span>
                  </div>
                  <UpdateGoalProgress goal={g} onDone={() => qc.invalidateQueries({ queryKey: ["goals"] })} currency={currency} />
                </CardContent>
              </Card>
            );
          })}
          {goals.length === 0 && (
            <Card className="md:col-span-2"><CardContent className="p-10 text-center text-sm text-muted-foreground">No goals yet. Set one to build momentum.</CardContent></Card>
          )}
        </div>
      </section>
    </div>
  );
}

function NewBudgetDialog({ onDone, existing }: { onDone: () => void; existing: Category[] }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("food");
  const [limit, setLimit] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const amt = parseFloat(limit);
      if (!amt || amt <= 0) throw new Error("Enter a valid limit");
      const { error } = await supabase.from("budgets").insert({
        user_id: userData.user.id, category, monthly_limit: amt, month: monthStart(),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Budget saved"); setOpen(false); setLimit(""); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const available = CATEGORIES.filter((c) => !existing.includes(c));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-brand text-white hover:opacity-90"><Plus className="mr-2 h-4 w-4" /> Add budget</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New monthly budget</DialogTitle><DialogDescription>Cap spending for a category this month.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(available.length ? available : CATEGORIES).map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_META[c].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Monthly limit</Label>
            <Input inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0.00" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending} className="bg-gradient-brand text-white hover:opacity-90">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewGoalDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const amt = parseFloat(target);
      if (!name.trim() || !amt || amt <= 0) throw new Error("Fill in name and target amount");
      const { error } = await supabase.from("savings_goals").insert({
        user_id: userData.user.id, name: name.trim(), target_amount: amt, target_date: date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Goal added"); setOpen(false); setName(""); setTarget(""); setDate(""); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> New goal</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Set a savings goal</DialogTitle><DialogDescription>Give it a name, target, and optional deadline.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Emergency fund" /></div>
          <div className="grid gap-2"><Label>Target amount</Label><Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="10000" /></div>
          <div className="grid gap-2"><Label>Target date (optional)</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending} className="bg-gradient-brand text-white hover:opacity-90">Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdateGoalProgress({ goal, onDone, currency }: { goal: Goal; onDone: () => void; currency: CurrencyCode }) {
  const [val, setVal] = useState("");
  const mut = useMutation({
    mutationFn: async () => {
      const add = parseFloat(val);
      if (!add || add <= 0) throw new Error("Enter an amount");
      const { error } = await supabase.from("savings_goals")
        .update({ current_amount: goal.current_amount + add })
        .eq("id", goal.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(`Added ${formatMoney(parseFloat(val), currency)}`); setVal(""); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <div className="mt-4 flex gap-2">
      <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Add contribution" inputMode="decimal" />
      <Button onClick={() => mut.mutate()} disabled={mut.isPending} variant="outline">Add</Button>
    </div>
  );
}
