import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppShell, ADMIN_NAV } from "../../components/AppShell";
import { Badge, statusTone } from "../../components/Badge";
import { api } from "../../api/client";
import type { CardStatusHistoryEntry } from "../../types";

interface CardDetail {
  id: string;
  cardNumber: string;
  maskedNumber: string;
  status: string;
  issuedAt: string;
  expiresAt: string;
  cardholderName: string;
  cardholderEmail: string;
  balance: number;
  history: CardStatusHistoryEntry[];
}

export default function AdminCardDetail() {
  const { id } = useParams();
  const [card, setCard] = useState<CardDetail | null>(null);
  const [loadAmount, setLoadAmount] = useState("500");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    api.get<CardDetail>(`/cards/${id}`).then(setCard);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleLoadFunds(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api.post(`/wallet/${id}/load`, { amount: parseFloat(loadAmount) });
      setMessage(`R${loadAmount} loaded successfully.`);
      load();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!card) {
    return (
      <AppShell navItems={ADMIN_NAV} title="Administrator">
        <p className="text-steel text-sm">Loading card...</p>
      </AppShell>
    );
  }

  return (
    <AppShell navItems={ADMIN_NAV} title="Administrator">
      <Link to="/admin/cards" className="text-sm text-steel hover:text-ink mb-4 inline-block">
        ← Back to cards
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="surface-card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="font-display text-xl font-semibold text-ink">{card.cardholderName}</h1>
                <p className="text-steel text-sm">{card.cardholderEmail}</p>
              </div>
              <Badge label={card.status} tone={statusTone(card.status)} />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-steel text-xs uppercase tracking-wide mb-1">Card number</div>
                <div className="card-number text-ink">{card.maskedNumber}</div>
              </div>
              <div>
                <div className="text-steel text-xs uppercase tracking-wide mb-1">Balance</div>
                <div className="font-mono text-ink text-lg">R{card.balance.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div className="text-steel text-xs uppercase tracking-wide mb-1">Issued</div>
                <div className="text-ink">{new Date(card.issuedAt).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-steel text-xs uppercase tracking-wide mb-1">Expires</div>
                <div className="text-ink">{new Date(card.expiresAt).toLocaleDateString()}</div>
              </div>
            </div>
          </div>

          <div className="surface-card p-6">
            <h2 className="font-display font-semibold text-ink mb-4">Status history</h2>
            <ul className="space-y-3">
              {card.history.map((h) => (
                <li key={h.id} className="text-sm flex items-center justify-between border-b border-slate-50 pb-3 last:border-0">
                  <div>
                    <span className="text-ink font-medium">{h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : `Issued as ${h.toStatus}`}</span>
                    {h.reason && <span className="text-steel"> — {h.reason}</span>}
                  </div>
                  <span className="text-xs text-steel">{new Date(h.changedAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="surface-card p-6 h-fit">
          <h2 className="font-display font-semibold text-ink mb-4">Load funds</h2>
          <form onSubmit={handleLoadFunds} className="space-y-3">
            <input
              type="number"
              min="1"
              step="0.01"
              value={loadAmount}
              onChange={(e) => setLoadAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-signal focus:ring-1 focus:ring-signal"
            />
            <button
              type="submit"
              disabled={busy || card.status !== "Active"}
              className="w-full btn-primary w-full text-sm"
            >
              {busy ? "Processing..." : "Load funds"}
            </button>
            {card.status !== "Active" && (
              <p className="text-xs text-amber">Funds can only be loaded onto an active card.</p>
            )}
            {message && <p className="text-xs text-steel">{message}</p>}
          </form>
        </div>
      </div>
    </AppShell>
  );
}
