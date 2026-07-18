import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddTransactionDialog } from "./dashboard";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/categories";
import { Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/transactions")({
  component: TransactionsPage,
});

type Tx = {
  id: string; type: "income" | "expense"; amount: number;
  category: Category; description: string | null; transaction_date: string;
};

function TransactionsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [cat, setCat] = useState<Category | "all">("all");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await supabase.from("profiles").select("*").maybeSingle()).data,
  });
  const currency = (profile?.currency ?? "USD") as CurrencyCode;

  const { data: txs = [] } = useQuery<Tx[]>({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions")
        .select("id,type,amount,category,description,transaction_date")
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as Tx[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["transactions"] }); },
  });

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (filter !== "all" && t.type !== filter) return false;
      if (cat !== "all" && t.category !== cat) return false;
      if (q && !(t.description ?? "").toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [txs, filter, cat, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Ledger</p>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Transactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every income and expense, in one clean list.</p>
        </div>
        <AddTransactionDialog onDone={() => qc.invalidateQueries({ queryKey: ["transactions"] })} />
      </div>

      <Card className="shadow-elegant">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes..." className="pl-9" />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
              </SelectContent>
            </Select>
            <Select value={cat} onValueChange={(v) => setCat(v as Category | "all")}>
              <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_META[c].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {filtered.map((t) => {
            const meta = CATEGORY_META[t.category];
            const Icon = meta.icon;
            return (
              <div key={t.id} className="flex items-center gap-4 px-6 py-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${meta.color}20`, color: meta.color }}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.description || meta.label}</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.transaction_date).toLocaleDateString()} · {meta.label}</div>
                </div>
                <div className={`text-sm font-semibold tabular-nums ${t.type === "income" ? "text-[var(--color-success)]" : "text-[var(--color-destructive)]"}`}>
                  {t.type === "income" ? "+" : "-"}{formatMoney(t.amount, currency)}
                </div>
                <Button variant="ghost" size="icon" onClick={() => del.mutate(t.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No transactions match those filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export { CardTitle };
