import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    navigate(user.role === "Administrator" ? "/admin" : "/portal", { replace: true });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Unable to sign in. Please check your details.");
    } finally {
      setSubmitting(false);
    }
  }

  const DEMO_ACCOUNTS = [
  { label: "Admin — Harsini Jayaraman", email: "admin@paycentral.test", password: "Admin@12345" },
  { label: "Cardholder — Pranushka P", email: "pranushka@paycentral.test", password: "Card@12345" },
  { label: "Cardholder — Praba J", email: "praba@paycentral.test", password: "Card@12345" },
  { label: "Cardholder — Anusiya A", email: "anusiya@paycentral.test", password: "Card@12345" },
  { label: "Cardholder — Mohana J", email: "mohana@paycentral.test", password: "Card@12345" },
  { label: "Cardholder — Jayaraman N", email: "jayaraman@paycentral.test", password: "Card@12345" },
  ];

  function fillDemo(selectedEmail: string) {
    const account = DEMO_ACCOUNTS.find((a) => a.email === selectedEmail);
    if (account) {
    setEmail(account.email);
    setPassword(account.password);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ink">
      {/* Left: brand panel with the signature "card stack" motif */}
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-ink-gradient" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand-gradient opacity-20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-violet/20 blur-3xl" />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-brand-gradient shadow-glow flex items-center justify-center font-display font-bold text-ink">
            P
          </div>
          <div>
            <div className="font-display text-2xl font-semibold text-white">PayCentral</div>
            <div className="text-mist text-xs mt-0.5">Corporate Expense Cards</div>
          </div>
        </div>

        <div className="relative z-10 space-y-4 max-w-sm">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl glass-panel p-5 bg-card-sheen animate-floatSlow"
              style={{
                transform: `translateX(${i * 14}px) translateY(${i * -6}px)`,
                animationDelay: `${i * 0.4}s`,
              }}
            >
              <div className="flex justify-between items-start text-mist">
                <span className="text-xs uppercase tracking-widest">Expense Card</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${i === 1 ? "bg-amber/20 text-amber" : "bg-signal/20 text-signal2"}`}>
                  {i === 1 ? "Suspended" : "Active"}
                </span>
              </div>
              <div className="font-mono text-lg text-white tracking-widest mt-6">
                •••• •••• •••• {(4218 + i * 17).toString().slice(-4)}
              </div>
            </div>
          ))}
        </div>

        <p className="relative z-10 text-mist text-sm max-w-sm">
          One platform for issuing, monitoring and protecting every prepaid expense card across your
          organisation.
        </p>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-8 bg-paper relative">
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{
          backgroundImage: "radial-gradient(circle at 80% 10%, #1FAE8A, transparent 35%)"
        }} />
        <div className="w-full max-w-sm relative animate-fadeUp">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-lg bg-brand-gradient flex items-center justify-center font-display font-bold text-ink text-sm">P</div>
            <div className="font-display text-2xl font-semibold text-ink">PayCentral</div>
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink">Welcome back</h1>
          <p className="text-steel text-sm mt-1 mb-6">Sign in to access your expense card dashboard.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-signal focus:ring-2 focus:ring-signal/20 outline-none text-sm transition-shadow"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-signal focus:ring-2 focus:ring-signal/20 outline-none text-sm transition-shadow"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div role="alert" className="text-sm text-coral bg-coral/10 ring-1 ring-coral/20 rounded-xl px-3 py-2.5">
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <label htmlFor="demo-account" className="block text-xs text-steel mb-2">
             Demo accounts (assessment use only):
            </label>
            <select
              id="demo-account"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) fillDemo(e.target.value);
              }}
              className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm text-ink outline-none focus:border-signal"
            >
              <option value="" disabled>
               Select a demo account to autofill...
              </option>
              {DEMO_ACCOUNTS.map((a) => (
                <option key={a.email} value={a.email}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
