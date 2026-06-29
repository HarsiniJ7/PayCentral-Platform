import { useEffect, useState } from "react";
import { AppShell, CARDHOLDER_NAV } from "../../components/AppShell";
import { LoadingRows, EmptyState } from "../../components/Common";
import { api } from "../../api/client";
import type { NotificationItem } from "../../types";

const CHANNEL_ICON: Record<string, string> = { Email: "✉️", SMS: "💬", Push: "🔔" };

export default function CardholderNotifications() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  function load() {
    api.get<{ data: NotificationItem[] }>("/notifications").then((r) => setItems(r.data));
  }

  useEffect(load, []);

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
    load();
  }

  return (
    <AppShell navItems={CARDHOLDER_NAV} title="Cardholder">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Notifications</h1>
        <p className="text-steel text-sm mt-1">Card activity and alerts. Email, SMS and push are simulated for this PoC.</p>
      </header>

      {!items ? (
        <LoadingRows rows={5} />
      ) : items.length === 0 ? (
        <EmptyState title="You're all caught up" message="New card activity will appear here." />
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              className={`bg-white rounded-xl border p-4 flex items-start gap-3 ${
                n.read ? "border-slate-100" : "border-signal/30 bg-signal/5"
              }`}
            >
              <span className="text-lg" aria-hidden>
                {CHANNEL_ICON[n.channel] || "🔔"}
              </span>
              <div className="flex-1">
                <p className="text-sm text-ink">{n.message}</p>
                <p className="text-xs text-steel mt-1">
                  {n.channel} · {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
              {!n.read && (
                <button onClick={() => markRead(n.id)} className="text-xs text-signal font-medium hover:underline shrink-0">
                  Mark read
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
