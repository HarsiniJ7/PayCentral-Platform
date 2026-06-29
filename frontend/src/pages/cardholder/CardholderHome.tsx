import { useEffect, useState } from "react";
import { AppShell, CARDHOLDER_NAV } from "../../components/AppShell";
import { Badge, statusTone } from "../../components/Badge";
import { LoadingRows } from "../../components/Common";
import { api } from "../../api/client";
import type { CardSummary, PaginatedResponse, Transaction } from "../../types";

export default function CardholderHome() {
  const [card, setCard] = useState<CardSummary | null>(null);
  const [recent, setRecent] = useState<Transaction[] | null>(null);

  useEffect(() => {
    api.get<PaginatedResponse<CardSummary>>("/cards?pageSize=1").then((r) => setCard(r.data[0] || null));
    api.get<PaginatedResponse<Transaction>>("/transactions?pageSize=5").then((r) => setRecent(r.data));
  }, []);

  return (
    <AppShell navItems={CARDHOLDER_NAV} title="Cardholder">
      <header className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-ink">My Card</h1>
        <p className="text-steel text-sm mt-1">Your balance, status and recent activity at a glance.</p>
      </header>

      {!card ? (
        <LoadingRows rows={4} />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="rounded-2xl p-6 text-white bg-ink-gradient shadow-lifted relative overflow-hidden">
              <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-brand-gradient opacity-25 blur-2xl" />
              <div className="absolute inset-0 bg-card-sheen" />
              <div className="relative flex justify-between items-start mb-10">
                <span className="font-display text-lg font-semibold">PayCentral</span>
                <Badge label={card.status} tone={statusTone(card.status)} />
              </div>
              <div className="relative font-mono text-xl tracking-widest mb-6">{card.maskedNumber}</div>
              <div className="relative flex justify-between items-end text-sm">
                <div>
                  <div className="text-mist text-xs uppercase tracking-wide">Available balance</div>
                  <div className="text-2xl font-display font-semibold mt-1 text-gradient">
                    R{card.balance.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-mist text-xs">Expires {new Date(card.expiresAt).toLocaleDateString()}</div>
              </div>
            </div>
            {card.status !== "Active" && (
              <div className="mt-4 text-sm bg-amber/10 text-amber rounded-lg px-4 py-3">
                Your card is currently <strong>{card.status.toLowerCase()}</strong>. Contact your administrator if
                this is unexpected.
              </div>
            )}
          </div>

          <div className="lg:col-span-2 surface-card p-6">
            <h2 className="font-display font-semibold text-ink mb-4">Recent transactions</h2>
            {!recent ? (
              <LoadingRows />
            ) : recent.length === 0 ? (
              <p className="text-sm text-steel">No transactions yet.</p>
            ) : (
              <ul className="divide-y divide-slate-50">
                {recent.map((t) => (
                  <li key={t.id} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <div className="text-ink font-medium">{t.merchantName || t.type}</div>
                      <div className="text-xs text-steel">{new Date(t.date).toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-ink">R{t.amount.toFixed(2)}</div>
                      <Badge label={t.status} tone={statusTone(t.status)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
