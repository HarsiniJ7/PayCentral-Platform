import { useCallback, useEffect, useState } from "react";
import { AppShell, ADMIN_NAV } from "../../components/AppShell";
import { StatCard, LoadingRows, SectionHeader } from "../../components/Common";
import { Badge, statusTone } from "../../components/Badge";
import { api } from "../../api/client";
import type { CardSummary, FraudAlert, PaginatedResponse } from "../../types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Link } from "react-router-dom";
import { useRealtime, useRealtimeEvent } from "../../lib/socket";

interface DailySummaryRow {
  day: string;
  transactionCount: number;
  totalSpend: number;
  totalLoaded: number;
  declinedCount: number;
}

export default function AdminOverview() {
  const [cards, setCards] = useState<CardSummary[] | null>(null);
  const [alerts, setAlerts] = useState<FraudAlert[] | null>(null);
  const [summary, setSummary] = useState<DailySummaryRow[] | null>(null);
  const { connected } = useRealtime();

  const loadData = useCallback(() => {
    api.get<PaginatedResponse<CardSummary>>("/cards?pageSize=100").then((r) => setCards(r.data));
    api.get<{ data: FraudAlert[] }>("/fraud-alerts?resolved=false").then((r) => setAlerts(r.data));
    api.get<{ data: DailySummaryRow[] }>("/reports/daily-summary").then((r) => setSummary(r.data.slice(0, 7).reverse()));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live dashboard: any transaction, fraud alert or card status change pushed
  // from the backend triggers a silent re-fetch instead of the admin having
  // to manually refresh the page to see new activity.
  useRealtimeEvent("transaction:new", loadData);
  useRealtimeEvent("fraud:alert", loadData);
  useRealtimeEvent("card:status-changed", loadData);
  useRealtimeEvent("card:issued", loadData);

  const totalBalance = cards?.reduce((sum, c) => sum + c.balance, 0) ?? 0;
  const activeCount = cards?.filter((c) => c.status === "Active").length ?? 0;
  const blockedCount = cards?.filter((c) => c.status === "Blocked" || c.status === "Suspended").length ?? 0;

  return (
    <AppShell navItems={ADMIN_NAV} title="Administrator">
      <SectionHeader
        title="Overview"
        subtitle="A snapshot of cards, spend and risk across your organisation."
        action={
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium text-steel"
            role="status"
            aria-live="polite"
          >
            <span
              className={`h-2 w-2 rounded-full ${connected ? "bg-signal animate-pulse" : "bg-steel/40"}`}
              aria-hidden="true"
            />
            {connected ? "Live" : "Offline"}
          </span>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total cards" value={cards ? String(cards.length) : "—"} sublabel={`${activeCount} active`} accent="signal" />
        <StatCard
          label="Total balance on issue"
          value={cards ? `R${totalBalance.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}` : "—"}
          accent="steel"
        />
        <StatCard
          label="Cards needing attention"
          value={String(blockedCount)}
          sublabel="Blocked or suspended"
          accent="amber"
        />
        <StatCard
          label="Open fraud alerts"
          value={alerts ? String(alerts.length) : "—"}
          accent="coral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 surface-card p-5">
          <h2 className="font-display font-semibold text-ink dark:text-white mb-4">Spend, last 7 active days</h2>
          {summary ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={summary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f1" />
                <XAxis dataKey="day" tickFormatter={(d) => d.slice(5)} fontSize={12} stroke="#3C5266" />
                <YAxis fontSize={12} stroke="#3C5266" />
                <Tooltip
                  formatter={(value: number, name: string) => [`R${value.toFixed(2)}`, name]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #eef0f1" }}
                />
                <Bar dataKey="totalSpend" name="Spend" fill="#1FAE8A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="totalLoaded" name="Loaded" fill="#3C5266" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <LoadingRows />
          )}
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-ink dark:text-white">Latest fraud alerts</h2>
            <Link to="/admin/fraud" className="text-xs text-signal font-medium hover:underline">
              View all
            </Link>
          </div>
          {!alerts ? (
            <LoadingRows />
          ) : alerts.length === 0 ? (
            <p className="text-sm text-steel">No open alerts. Nice and quiet.</p>
          ) : (
            <ul className="space-y-3">
              {alerts.slice(0, 5).map((a) => (
                <li key={a.id} className="text-sm border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-ink dark:text-white">{a.cardholderName}</span>
                    <Badge label={a.severity} tone={statusTone(a.severity)} />
                  </div>
                  <p className="text-steel text-xs">{a.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
