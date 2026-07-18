import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/assistant")({
  component: AssistantPage,
});

function AssistantPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">AI</p>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Finance coach</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your personal AI advisor — arriving next.</p>
      </div>

      <Card className="relative overflow-hidden shadow-elegant">
        <div className="absolute inset-0 bg-gradient-mesh opacity-70" />
        <CardHeader className="relative">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-brand text-white shadow-glow">
            <Sparkles className="h-6 w-6" />
          </div>
          <CardTitle className="mt-4 font-display text-2xl">Chat with FinPilot — coming next</CardTitle>
          <CardDescription className="max-w-lg">
            The AI Coach will analyze your spending, suggest smarter budgets, and answer any money question in your currency and context.
            We've wired up the data model so it can plug straight in.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              "How much did I spend on food last month?",
              "How can I save $500 more?",
              "Am I over budget anywhere?",
            ].map((q) => (
              <div key={q} className="rounded-xl border border-border bg-card/70 p-4 text-sm text-muted-foreground backdrop-blur">
                "{q}"
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
