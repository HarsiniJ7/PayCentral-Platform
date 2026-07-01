import { useEffect, useState } from "react";
import { AppShell, ADMIN_NAV } from "../../components/AppShell";
import { Badge, statusTone } from "../../components/Badge";
import { Pagination, LoadingRows, EmptyState } from "../../components/Common";
import { api } from "../../api/client";
import type { CardSummary, PaginatedResponse } from "../../types";
import { Link } from "react-router-dom";
import { IssueCardModal } from "./IssueCardModal";

export default function AdminCards() {
  const [result, setResult] = useState<PaginatedResponse<CardSummary> | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [showIssueModal, setShowIssueModal] = useState(false);

  function load() {
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    api.get<PaginatedResponse<CardSummary>>(`/cards?${params.toString()}`).then(setResult);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  async function handleStatusChange(cardId: string, newStatus: string) {
    const reason = window.prompt(`Reason for changing card to ${newStatus}?`) || undefined;
    try {
      await api.patch(`/cards/${cardId}/status`, { status: newStatus, reason });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <AppShell navItems={ADMIN_NAV} title="Administrator">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Cardholders & Cards</h1>
          <p className="text-steel text-sm mt-1">Search, issue and manage expense cards.</p>
        </div>
        <button
          onClick={() => setShowIssueModal(true)}
          className="btn-primary text-sm"
        >
          Issue new card
        </button>
      </header>

      <form onSubmit={handleSearchSubmit} className="flex gap-3 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by card number or cardholder name"
          className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:border-signal focus:ring-1 focus:ring-signal outline-none"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm outline-none"
        >
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Blocked">Blocked</option>
          <option value="Suspended">Suspended</option>
          <option value="Closed">Closed</option>
        </select>
        <button type="submit" className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">
          Search
        </button>
      </form>

      <div className="surface-card overflow-hidden">
        {!result ? (
          <div className="p-5">
            <LoadingRows rows={6} />
          </div>
        ) : result.data.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No cards match your search" message="Try a different name, card number, or clear the status filter." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-steel text-xs uppercase tracking-wide">
              <tr>
                <th scope="col" className="text-left px-5 py-3 font-medium">Cardholder</th>
                <th scope="col" className="text-left px-5 py-3 font-medium">Card</th>
                <th scope="col" className="text-left px-5 py-3 font-medium">Balance</th>
                <th scope="col" className="text-left px-5 py-3 font-medium">Status</th>
                <th scope="col" className="text-right px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((c) => (
                <tr key={c.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-3">
                    <Link to={`/admin/cards/${c.id}`} className="font-medium text-ink hover:text-signal">
                      {c.cardholderName}
                    </Link>
                    <div className="text-xs text-steel">{c.cardholderEmail}</div>
                  </td>
                  <td className="px-5 py-3 card-number text-xs text-steel">{c.maskedNumber}</td>
                  <td className="px-5 py-3 font-mono text-ink">
                    R{c.balance.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3">
                    <Badge label={c.status} tone={statusTone(c.status)} />
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    {c.status === "Active" && (
                      <button onClick={() => handleStatusChange(c.id, "Blocked")} className="text-xs text-coral font-medium hover:underline">
                        Block
                      </button>
                    )}
                    {(c.status === "Blocked" || c.status === "Suspended") && (
                      <button onClick={() => handleStatusChange(c.id, "Active")} className="text-xs text-signal font-medium hover:underline">
                        Unblock
                      </button>
                    )}
                    {c.status === "Active" && (
                      <button onClick={() => handleStatusChange(c.id, "Suspended")} className="text-xs text-amber font-medium hover:underline">
                        Suspend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {result && (
          <div className="px-5 pb-5">
            <Pagination page={result.page} pageSize={result.pageSize} total={result.total} onPageChange={setPage} />
          </div>
        )}
      </div>

      {showIssueModal && (
        <IssueCardModal
          onClose={() => setShowIssueModal(false)}
          onIssued={() => {
            setShowIssueModal(false);
            load();
          }}
        />
      )}
    </AppShell>
  );
}
