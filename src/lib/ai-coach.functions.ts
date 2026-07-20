import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

export const chatWithCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const d = input as { messages: ChatMsg[] };
    if (!Array.isArray(d?.messages)) throw new Error("messages required");
    return { messages: d.messages.slice(-20) };
  })
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    // Load user finance snapshot for context
    const [{ data: profile }, { data: txs }, { data: goals }, { data: budgets }] = await Promise.all([
      context.supabase.from("profiles").select("display_name,currency").maybeSingle(),
      context.supabase.from("transactions").select("type,amount,category,description,transaction_date").order("transaction_date", { ascending: false }).limit(120),
      context.supabase.from("savings_goals").select("name,target_amount,current_amount,target_date"),
      context.supabase.from("budgets").select("category,monthly_limit,month"),
    ]);

    const currency = profile?.currency ?? "USD";
    const income = (txs ?? []).filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expenses = (txs ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const byCat: Record<string, number> = {};
    (txs ?? []).filter((t) => t.type === "expense").forEach((t) => {
      byCat[t.category] = (byCat[t.category] ?? 0) + Number(t.amount);
    });

    const system = `You are FinPilot AI — a warm, expert personal finance coach.
User: ${profile?.display_name ?? "there"} · Currency: ${currency}
Snapshot (last ~120 tx):
- Income: ${income.toFixed(2)} ${currency}
- Expenses: ${expenses.toFixed(2)} ${currency}
- Net: ${(income - expenses).toFixed(2)} ${currency}
- Spend by category: ${JSON.stringify(byCat)}
- Goals: ${JSON.stringify(goals ?? [])}
- Budgets: ${JSON.stringify(budgets ?? [])}

Guidelines: Be concise, use markdown with headings & bullets when helpful.
Always format money with the user's currency (${currency}). Give specific numeric advice
(e.g. "cut Food by 15% to save ~${currency} 120/mo"). When asked to build a budget,
propose category limits as a bulleted list. Predict end-of-month balance using current trend
when relevant. Never invent transactions.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("AI is rate-limited — please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits to continue.");
      throw new Error(`AI error: ${text.slice(0, 200)}`);
    }
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "I couldn't generate a response.";
    return { content };
  });
