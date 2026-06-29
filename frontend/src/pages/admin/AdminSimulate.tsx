import { useEffect, useState } from "react";
import { AppShell, ADMIN_NAV } from "../../components/AppShell";
import { Badge, statusTone } from "../../components/Badge";
import { EmptyState } from "../../components/Common";
import { api, ApiError } from "../../api/client";
import type { CardSummary, Merchant } from "../../types";

interface LogEntry {
  id: string;
  time: string;
  label: string;
  ok: boolean;
  message: string;
  fraudCount?: number;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

async function debit(cardId: string, body: Record<string, unknown>) {
  return api.post<{ id: string; newBalance: number; fraudAlertsTriggered: number }>(
    `/wallet/${cardId}/debit`,
    body
  );
}

export default function AdminSimulate() {
  const [search, setSearch] = useState("");
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardSummary | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);

  const [amount, setAmount] = useState("250");
  const [merchantId, setMerchantId] = useState("");
  const [txnType, setTxnType] = useState("Purchase");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    api.get<{ data: Merchant[] }>("/merchants").then((r) => {
      setMerchants(r.data);
      if (r.data.length) setMerchantId(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams({ pageSize: "8" });
      if (search) params.set("search", search);
      api.get<{ data: CardSummary[] }>(`/cards?${params.toString()}`).then((r) => setCards(r.data));
    }, 250);
    return () => clearTimeout(handle);
  }, [search]);

  function pushLog(entry: Omit<LogEntry, "id" | "time">) {
    setLog((prev) => [{ id: uid(), time: new Date().toLocaleTimeString(), ...entry }, ...prev].slice(0, 25));
  }

  async function refreshSelectedCard() {
    if (!selectedCard) return;
    const fresh = await api.get<CardSummary>(`/cards/${selectedCard.id}`);
    setSelectedCard(fresh);
  }

  async function sendOne(opts: { amount: number; merchantId?: string; type?: string; label: string }) {
    if (!selectedCard) return;
    try {
      const res = await debit(selectedCard.id, {
        amount: opts.amount,
        merchantId: opts.merchantId,
        type: opts.type || "Purchase",
        idempotencyKey: uid(),
      });
      pushLog({
        label: opts.label,
        ok: true,
        message: `Approved · new balance R${res.newBalance.toFixed(2)}${
          res.fraudAlertsTriggered ? ` · ${res.fraudAlertsTriggered} fraud alert(s) raised` : ""
        }`,
        fraudCount: res.fraudAlertsTriggered,
      });
    } catch (e) {
      const err = e as ApiError;
      pushLog({ label: opts.label, ok: false, message: err.message || "Request failed" });
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCard) return;
    setBusy(true);
    await sendOne({
      amount: parseFloat(amount) || 0,
      merchantId: merchantId || undefined,
      type: txnType,
      label: `Manual ${txnType} · R${amount}`,
    });
    await refreshSelectedCard();
    setBusy(false);
  }

  async function runPreset(key: string) {
    if (!selectedCard) return;
    setBusy(true);

    if (key === "highValue") {
      await sendOne({ amount: 25000, merchantId, label: "Preset: High-value purchase (>R20,000)" });
    }

    if (key === "international") {
      const intl = merchants.find((m) => m.country !== "ZA");
      await sendOne({
        amount: 450,
        merchantId: intl?.id,
        label: `Preset: International transaction (${intl?.name || "foreign merchant"})`,
      });
    }

    if (key === "rapid") {
      for (let i = 0; i < 3; i++) {
        await sendOne({ amount: 50, merchantId, label: `Preset: Rapid purchase #${i + 1}` });
      }
    }

    if (key === "multiCategory") {
      const byCategory = new Map<string, Merchant>();
      merchants.forEach((m) => {
        if (!byCategory.has(m.category)) byCategory.set(m.category, m);
      });
      const picks = Array.from(byCategory.values()).slice(0, 3);
      for (const m of picks) {
        await sendOne({ amount: 60, merchantId: m.id, label: `Preset: ${m.category} purchase (${m.name})` });
      }
    }

    if (key === "declines") {
      const overAmount = (selectedCard.balance || 0) + 100000;
      for (let i = 0; i < 5; i++) {
        await sendOne({ amount: overAmount, merchantId, label: `Preset: Declined attempt #${i + 1} (insufficient funds)` });
      }
      // one small, fundable purchase so the fraud engine's decline-velocity check actually runs
      await sendOne({ amount: 20, merchantId, label: "Preset: Follow-up purchase to trigger RepeatedDeclines check" });
    }

    if (key === "blockedCard") {
      await sendOne({
        amount: 100,
        merchantId,
        label: `Preset: Transaction on ${selectedCard.status} card`,
      });
    }

    await refreshSelectedCard();
    setBusy(false);
  }

  return (
    <AppShell navItems={ADMIN_NAV} title="Administrator">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Simulate Transaction</h1>
        <p className="text-steel text-sm mt-1">
          Fire test purchases against any card to exercise the wallet and fraud rule engine — useful for demos and QA.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card picker */}
        <div className="surface-card p-5">
          <div className="text-xs uppercase tracking-wide text-steel font-medium mb-3">1. Pick a card</div>
          <input
            placeholder="Search by card number or cardholder"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-signal mb-3"
          />
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {cards.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCard(c)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  selectedCard?.id === c.id
                    ? "border-signal bg-signal/5"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-ink font-medium">{c.cardholderName}</span>
                  <Badge label={c.status} tone={statusTone(c.status)} />
                </div>
                <div className="text-xs text-steel card-number mt-0.5">{c.maskedNumber}</div>
                <div className="text-xs text-steel mt-0.5">Balance: R{c.balance.toFixed(2)}</div>
              </button>
            ))}
            {cards.length === 0 && <div className="text-xs text-steel py-4 text-center">No cards found.</div>}
          </div>
        </div>

        {/* Transaction form + presets */}
        <div className="surface-card p-5 lg:col-span-2">
          {!selectedCard ? (
            <EmptyState title="No card selected" message="Choose a card on the left to start simulating transactions." />
          ) : (
            <>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-xs uppercase tracking-wide text-steel font-medium">Selected card</div>
                  <div className="text-ink font-medium mt-0.5">{selectedCard.cardholderName}</div>
                  <div className="text-xs text-steel card-number">{selectedCard.maskedNumber}</div>
                </div>
                <div className="text-right">
                  <Badge label={selectedCard.status} tone={statusTone(selectedCard.status)} />
                  <div className="text-sm font-mono text-ink mt-1">R{selectedCard.balance.toFixed(2)}</div>
                </div>
              </div>

              <div className="text-xs uppercase tracking-wide text-steel font-medium mb-2">2. Manual transaction</div>
              <form onSubmit={handleManualSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount (R)"
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-signal"
                />
                <select
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none"
                >
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.country})
                    </option>
                  ))}
                </select>
                <select
                  value={txnType}
                  onChange={(e) => setTxnType(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none"
                >
                  <option value="Purchase">Purchase</option>
                  <option value="Fee">Fee</option>
                </select>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-ink text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Send transaction"}
                </button>
              </form>

              <div className="text-xs uppercase tracking-wide text-steel font-medium mb-2">3. Fraud rule presets</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-6">
                <PresetButton disabled={busy} onClick={() => runPreset("highValue")} title="High-value purchase" subtitle=">R20,000 in one go" />
                <PresetButton disabled={busy} onClick={() => runPreset("rapid")} title="Rapid purchases" subtitle="3 purchases back to back" />
                <PresetButton disabled={busy} onClick={() => runPreset("multiCategory")} title="Multi-category burst" subtitle="3 categories in a minute" />
                <PresetButton disabled={busy} onClick={() => runPreset("international")} title="International txn" subtitle="Foreign merchant" />
                <PresetButton disabled={busy} onClick={() => runPreset("declines")} title="Repeated declines" subtitle="5 failed + 1 follow-up" />
                <PresetButton
                  disabled={busy || selectedCard.status === "Active"}
                  onClick={() => runPreset("blockedCard")}
                  title="Inactive card attempt"
                  subtitle={selectedCard.status === "Active" ? "Block/suspend the card first" : `Card is ${selectedCard.status}`}
                />
              </div>

              <div className="text-xs uppercase tracking-wide text-steel font-medium mb-2">Activity log</div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {log.length === 0 && <div className="text-xs text-steel py-3">Run a transaction to see results here.</div>}
                {log.map((entry) => (
                  <div
                    key={entry.id}
                    className={`px-3 py-2 rounded-lg text-xs border ${
                      entry.ok ? "border-slate-200 bg-slate-50/60" : "border-coral/30 bg-coral/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-ink">{entry.label}</span>
                      <span className="text-steel">{entry.time}</span>
                    </div>
                    <div className={entry.ok ? "text-steel mt-0.5" : "text-coral mt-0.5"}>{entry.message}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function PresetButton({
  title,
  subtitle,
  onClick,
  disabled,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-left px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <div className="text-sm font-medium text-ink">{title}</div>
      <div className="text-xs text-steel mt-0.5">{subtitle}</div>
    </button>
  );
}
