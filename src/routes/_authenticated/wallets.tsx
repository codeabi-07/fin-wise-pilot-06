import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/currency";
import { useFinance, useInvalidateFinance } from "@/hooks/use-finance";
import { Banknote, Landmark, CreditCard, Smartphone, Plus, Trash2, Scale, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/wallets")({
  head: () => ({ meta: [
    { title: "Wallets · FinPilot AI" },
    { name: "description", content: "See exactly how much money you have right now across cash, bank and cards." },
    { property: "og:title", content: "Wallets · FinPilot AI" },
    { property: "og:description", content: "Your money on hand, across every wallet." },
  ] }),
  component: WalletsPage,
});

const KINDS = { cash: { label: "Cash", icon: Banknote }, bank: { label: "Bank", icon: Landmark }, card: { label: "Card", icon: CreditCard }, ewallet: { label: "UPI / e-wallet", icon: Smartphone } } as const;
type Kind = keyof typeof KINDS;

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

function WalletsPage() {
  const f = useFinance();
  const inv = useInvalidateFinance();
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("wallets").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Wallet removed"); inv(); },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Money on hand</p>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Wallets</h1>
          <p className="mt-1 text-sm text-muted-foreground">Where your money sits right now.</p>
        </div>
        <WalletDialog onDone={inv} />
      </div>

      <Card className="relative overflow-hidden shadow-elegant">
        <div className="absolute inset-0 bg-gradient-mesh opacity-60" />
        <CardContent className="relative p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total money with me</p>
          <div className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">{formatMoney(f.totalOnHand, f.currency)}</div>
          <p className="mt-2 text-sm text-muted-foreground">Across {f.wallets.length} wallet{f.wallets.length === 1 ? "" : "s"} · goal savings excluded</p>
        </CardContent>
      </Card>

      {f.wallets.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">
          <Wallet className="mx-auto mb-3 h-8 w-8 text-accent" />
          Add your first wallet (e.g. "Cash" or "Bank") with the amount you have today.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {f.walletBalances.map((w) => {
            const Icon = KINDS[(w.kind as Kind)]?.icon ?? Wallet;
            return (
              <Card key={w.id} className="shadow-elegant">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-white"><Icon className="h-5 w-5" /></div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{w.name}</CardTitle>
                    <CardDescription>{KINDS[(w.kind as Kind)]?.label ?? w.kind}</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => del.mutate(w.id)} aria-label="Delete wallet"><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="font-display text-2xl font-bold tabular-nums">{formatMoney(w.balance, f.currency)}</div>
                  <AdjustDialog walletId={w.id} current={w.balance} onDone={inv} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <IncomeSettings income={Number(f.profile?.monthly_income ?? 0)} salaryDay={f.profile?.salary_day ?? 1} onDone={inv} />
    </div>
  );
}

function WalletDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("cash");
  const [amount, setAmount] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Give it a name");
      const { error } = await supabase.from("wallets").insert({ user_id: await uid(), name: name.trim(), kind, opening_balance: parseFloat(amount) || 0 });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Wallet added"); setOpen(false); setName(""); setAmount(""); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="bg-gradient-brand text-white shadow-glow hover:opacity-90"><Plus className="mr-2 h-4 w-4" /> Add wallet</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New wallet</DialogTitle><DialogDescription>How much money is here today?</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="HDFC Savings" /></div>
          <div className="grid gap-2"><Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(KINDS) as Kind[]).map((k) => <SelectItem key={k} value={k}>{KINDS[k].label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2"><Label>Current amount</Label><Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
        </div>
        <DialogFooter><Button onClick={() => m.mutate()} disabled={m.isPending}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({ walletId, current, onDone }: { walletId: string; current: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      const real = parseFloat(amount);
      if (isNaN(real)) throw new Error("Enter an amount");
      const diff = real - current;
      if (Math.abs(diff) < 0.005) return;
      const { error } = await supabase.from("transactions").insert({
        user_id: await uid(), wallet_id: walletId, type: diff > 0 ? "income" : "expense", amount: Math.abs(diff),
        category: "other", description: "Balance adjustment", purpose: "Balance adjustment",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Balance updated"); setOpen(false); setAmount(""); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm" className="w-full"><Scale className="mr-2 h-4 w-4" /> Adjust balance</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>How much is really here?</DialogTitle><DialogDescription>We'll record the difference as an adjustment.</DialogDescription></DialogHeader>
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={current.toFixed(2)} />
        <DialogFooter><Button onClick={() => m.mutate()} disabled={m.isPending}>Update</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IncomeSettings({ income, salaryDay, onDone }: { income: number; salaryDay: number; onDone: () => void }) {
  const [inc, setInc] = useState("");
  const [day, setDay] = useState("1");
  useEffect(() => { setInc(income ? String(income) : ""); setDay(String(salaryDay)); }, [income, salaryDay]);
  const m = useMutation({
    mutationFn: async () => {
      const d = Math.min(31, Math.max(1, parseInt(day) || 1));
      const { error } = await supabase.from("profiles").update({ monthly_income: parseFloat(inc) || null, salary_day: d }).eq("id", await uid());
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); onDone(); },
  });
  return (
    <Card className="shadow-elegant">
      <CardHeader><CardTitle>Income & payday</CardTitle><CardDescription>Used to work out how much you can safely spend each day.</CardDescription></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
        <div className="grid gap-2"><Label>Monthly income</Label><Input inputMode="decimal" value={inc} onChange={(e) => setInc(e.target.value)} placeholder="50000" /></div>
        <div className="grid gap-2"><Label>Salary day (1–31)</Label><Input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} /></div>
        <Button onClick={() => m.mutate()} disabled={m.isPending}>Save</Button>
      </CardContent>
    </Card>
  );
}
