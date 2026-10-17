import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/currency";
import { useFinance, useInvalidateFinance } from "@/hooks/use-finance";
import { Calculator, PiggyBank } from "lucide-react";
import { toast } from "sonner";

const STATUS = {
  done: { label: "Completed", cls: "bg-success/15 text-success" },
  ahead: { label: "Ahead", cls: "bg-success/15 text-success" },
  "on-track": { label: "On track", cls: "bg-accent/15 text-accent" },
  behind: { label: "Behind", cls: "bg-destructive/15 text-destructive" },
  "no-date": { label: "No deadline", cls: "bg-muted text-muted-foreground" },
} as const;

export function SafeToSpendCard() {
  const f = useFinance();
  const m = (v: number) => formatMoney(v, f.currency);
  return (
    <Card className="relative overflow-hidden border-accent/30 shadow-elegant">
      <div className="absolute inset-0 bg-gradient-mesh opacity-50" />
      <CardContent className="relative grid gap-4 p-5 sm:grid-cols-3">
        <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Save this month for goals</p><div className="font-display text-2xl font-bold">{m(f.goalMonthly)}</div></div>
        <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Safe to spend till payday</p><div className="font-display text-2xl font-bold">{m(Math.max(0, f.safe))}</div>
          <p className="text-xs text-muted-foreground">{f.daysToPay} days to {f.nextPay.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p></div>
        <div><p className="text-xs uppercase tracking-wider text-muted-foreground">You can spend per day</p><div className="font-display text-2xl font-bold text-gradient">{m(f.perDay)}</div>
          {!f.profile?.monthly_income && <p className="text-xs text-muted-foreground">Set your monthly income in Wallets for accuracy</p>}
          {f.safe < 0 && <p className="text-xs text-destructive">Over plan by {m(-f.safe)}</p>}</div>
      </CardContent>
    </Card>
  );
}

export function GoalPlanner() {
  const f = useFinance();
  const inv = useInvalidateFinance();
  const m = (v: number) => formatMoney(v, f.currency);
  if (f.goalPlans.length === 0) return null;
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Calculator className="h-5 w-5 text-accent" /> Goal planner</h2>
      <SafeToSpendCard />
      <div className="grid gap-4 md:grid-cols-2">
        {f.goalPlans.map((g) => {
          const pct = g.target_amount > 0 ? Math.min(100, (g.saved / g.target_amount) * 100) : 0;
          const st = STATUS[g.status];
          return (
            <Card key={g.id} className="shadow-elegant">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div><CardTitle className="text-base">{g.name}</CardTitle>
                  <CardDescription>{m(g.saved)} of {m(g.target_amount)}{g.target_date ? ` · by ${new Date(g.target_date).toLocaleDateString()}` : ""}</CardDescription></div>
                <Badge className={st.cls} variant="outline">{st.label}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={pct} />
                {g.req ? (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[["/ month", g.req.perMonth], ["/ week", g.req.perWeek], ["/ day", g.req.perDay]].map(([l, v]) => (
                      <div key={l as string} className="rounded-xl bg-muted/50 p-2"><div className="text-sm font-semibold tabular-nums">{m(v as number)}</div><div className="text-[10px] text-muted-foreground">save {l}</div></div>
                    ))}
                  </div>
                ) : g.remaining > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {g.eta ? <>At your current pace you'll finish around <b>{g.eta.toLocaleDateString()}</b>.</> : <>Add a target date, or start adding money, to get a plan.</>}
                  </p>
                )}
                {g.req && g.remaining > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {g.status === "behind"
                      ? `You're saving ~${m(g.pace)}/month. Add ${m(g.req.perMonth - g.pace)} more each month to stay on track.`
                      : `Your pace of ~${m(g.pace)}/month covers this goal.`}
                  </p>
                )}
                {g.remaining > 0 && <ContributeDialog goalId={g.id} current={g.saved} onDone={inv} />}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function ContributeDialog({ goalId, current, onDone }: { goalId: string; current: number; onDone: () => void }) {
  const f = useFinance();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState<string>("");
  const mut = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(amount);
      if (!amt || amt <= 0) throw new Error("Enter an amount");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("goal_contributions").insert({ user_id: u.user.id, goal_id: goalId, wallet_id: wallet || f.wallets[0]?.id || null, amount: amt });
      if (error) throw error;
      const { error: e2 } = await supabase.from("savings_goals").update({ current_amount: current + amt }).eq("id", goalId);
      if (e2) throw e2;
    },
    onSuccess: () => { toast.success("Added to goal"); setOpen(false); setAmount(""); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm" className="w-full"><PiggyBank className="mr-2 h-4 w-4" /> Add money to goal</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add money to goal</DialogTitle><DialogDescription>Moves money out of a wallet into this goal.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          {f.wallets.length > 0 && (
            <Select value={wallet || f.wallets[0].id} onValueChange={setWallet}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{f.walletBalances.map((w) => <SelectItem key={w.id} value={w.id}>{w.name} · {formatMoney(w.balance, f.currency)}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending}>Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
