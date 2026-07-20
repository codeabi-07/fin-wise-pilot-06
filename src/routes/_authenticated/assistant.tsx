import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles, Send, Loader2, Wallet, PieChart, Target, TrendingUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { chatWithCoach } from "@/lib/ai-coach.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assistant")({
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string; id: string };

const SUGGESTIONS = [
  { icon: PieChart, label: "Analyze my spending this month" },
  { icon: Target, label: "Build me a monthly budget" },
  { icon: TrendingUp, label: "Predict my end-of-month balance" },
  { icon: Wallet, label: "How can I save 20% more?" },
];

function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatFn = useServerFn(chatWithCoach);

  const mutation = useMutation({
    mutationFn: async (next: Msg[]) => {
      const res = await chatFn({ data: { messages: next.map((m) => ({ role: m.role, content: m.content })) } });
      return res.content;
    },
    onSuccess: (content) => {
      setMessages((m) => [...m, { role: "assistant", content, id: crypto.randomUUID() }]);
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, mutation.isPending]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || mutation.isPending) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed, id: crypto.randomUUID() }];
    setMessages(next);
    setInput("");
    mutation.mutate(next);
  };

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-brand text-white shadow-glow">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">AI Finance Coach</h1>
          <p className="text-sm text-muted-foreground">Personalized advice from your real data — private & secure.</p>
        </div>
      </div>

      <Card className="relative flex flex-1 flex-col overflow-hidden border-border/60 shadow-elegant">
        <div className="pointer-events-none absolute inset-0 bg-gradient-mesh opacity-60" />
        <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 py-6 md:px-8">
          {messages.length === 0 ? (
            <div className="mx-auto max-w-xl space-y-6 py-8">
              <div className="text-center">
                <h2 className="font-display text-2xl font-bold">How can I help you today?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ask about your spending, budgets, or savings goals.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => send(s.label)}
                    className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 text-left text-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-glow"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent-foreground">
                      <s.icon className="h-4 w-4 text-accent" />
                    </div>
                    <span className="font-medium">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              {messages.map((m) => (
                <MessageRow key={m.id} msg={m} />
              ))}
              {mutation.isPending && (
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8"><AvatarFallback className="bg-gradient-brand text-white"><Sparkles className="h-4 w-4" /></AvatarFallback></Avatar>
                  <div className="flex items-center gap-2 rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground backdrop-blur">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative border-t border-border/60 bg-background/70 p-3 backdrop-blur md:p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="mx-auto flex max-w-3xl items-end gap-2"
          >
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
              }}
              rows={1}
              placeholder="Ask your finance coach anything..."
              className="min-h-11 resize-none rounded-xl"
              disabled={mutation.isPending}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || mutation.isPending}
              className="h-11 w-11 shrink-0 bg-gradient-brand text-white shadow-glow hover:opacity-90"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

function MessageRow({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={isUser ? "bg-primary text-primary-foreground text-xs" : "bg-gradient-brand text-white"}>
          {isUser ? "You" : <Sparkles className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card/80 text-card-foreground backdrop-blur border border-border/60",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-headings:mt-3 prose-headings:mb-1 prose-ul:my-2 prose-li:my-0.5">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
