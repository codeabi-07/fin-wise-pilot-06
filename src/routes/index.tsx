import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, LineChart, PiggyBank, Sparkles, Wallet, ShieldCheck, Globe } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background bg-gradient-mesh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">FinPilot <span className="text-gradient">AI</span></span>
        </Link>
        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild><Link to="/dashboard">Open dashboard</Link></Button>
          ) : (
            <>
              <Button variant="ghost" asChild><Link to="/auth">Sign in</Link></Button>
              <Button asChild className="bg-gradient-brand text-white hover:opacity-90"><Link to="/auth" search={{ mode: "signup" }}>Get started</Link></Button>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10 md:pt-20">
        <section className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-elegant">
            <Sparkles className="h-3.5 w-3.5 text-accent" /> AI-powered personal finance
          </div>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            Your money, <span className="text-gradient">on autopilot.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground md:text-xl">
            FinPilot AI tracks every rupee, dollar, and dirham — then tells you exactly how to save more,
            spend smarter, and hit your goals faster.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild className="bg-gradient-brand text-white hover:opacity-90 shadow-glow">
              <Link to="/auth" search={{ mode: "signup" }}>Start for free <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth">I already have an account</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">No credit card required · INR · USD · AED · EUR · GBP</p>
        </section>

        <section className="mt-24 grid gap-6 md:grid-cols-3">
          {[
            { icon: LineChart, title: "Real-time dashboard", body: "Balance, income, expenses, savings and a live financial health score — all in one view." },
            { icon: PiggyBank, title: "Smart budgets", body: "Set monthly limits per category, track progress, and hit savings goals with confidence." },
            { icon: Sparkles, title: "AI finance coach", body: "Chat with an assistant that reads your spending and gives you personalized advice." },
            { icon: Globe, title: "5 currencies", body: "Native support for INR, USD, AED, EUR, and GBP — switch anytime." },
            { icon: ShieldCheck, title: "Private by default", body: "Your data lives in your account with row-level security. Never sold, never shared." },
            { icon: Wallet, title: "Every category", body: "Food, transport, bills, shopping, entertainment, salary — organized automatically." },
          ].map((f) => (
            <div key={f.title} className="group rounded-2xl border border-border bg-card p-6 shadow-elegant transition-all hover:-translate-y-1 hover:shadow-glow">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-brand text-white">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} FinPilot AI</span>
          <span>Built with love for smart money.</span>
        </div>
      </footer>
    </div>
  );
}
