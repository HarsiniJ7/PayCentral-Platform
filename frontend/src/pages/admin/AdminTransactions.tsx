import { useEffect, useState } from "react";
import { AppShell, ADMIN_NAV } from "../../components/AppShell";
import { Badge, statusTone } from "../../components/Badge";
import { Pagination, LoadingRows, EmptyState } from "../../components/Common";
import { api } from "../../api/client";
import type { PaginatedResponse, Transaction } from "../../types";

export default function AdminTransactions() {
  const [result, setResult] = useState<PaginatedResponse<Transaction> | null>(null);
  const [filters, setFilters] = useState({ cardNumber: "", reference: "", merchant: "", status: "", dateFrom: "", dateTo: "" });
  const [page, setPage] = useState(1);

  function load() {
    const params = new URLSearchParams({ page: String(page), pageSize: "12" });
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    api.get<PaginatedResponse<Transaction>>(`/transactions?${params.toString()}`).then(setResult);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  return (
    <AppShell navItems={ADMIN_NAV} title="Administrator">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Transactions</h1>
        <p className="text-steel text-sm mt-1">Search every purchase, load, refund and reversal across the platform.</p>
      </header>

      <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <input
          placeholder="Card number"
          value={filters.cardNumber}
          onChange={(e) => setFilters({ ...filters, cardNumber: e.target.value })}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-signal"
        />
        <input
          placeholder="Reference"
          value={filters.reference}
          onChange={(e) => setFilters({ ...filters, reference: e.target.value })}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-signal"
        />
        <input
          placeholder="Merchant"
          value={filters.merchant}
          onChange={(e) => setFilters({ ...filters, merchant: e.target.value })}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-signal"
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none"
        >
          <option value="">Any status</option>
          <option value="Completed">Completed</option>
          <option value="Declined">Declined</option>
          <option value="Pending">Pending</option>
          <option value="Reversed">Reversed</option>
        </select>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none"
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none"
        />
        <button type="submit" className="col-span-2 md:col-span-1 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium hover:bg-slate-50">
          Apply filters
        </button>
      </form>

      <div className="surface-card overflow-hidden">
        {!result ? (
          <div className="p-5">
            <LoadingRows rows={8} />
          </div>
        ) : result.data.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No transactions found" message="Adjust your filters and try again." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-steel text-xs uppercase tracking-wide">
              <tr>
                <th scope="col" className="text-left px-5 py-3 font-medium">Reference</th>
                <th scope="col" className="text-left px-5 py-3 font-medium">Card</th>
                <th scope="col" className="text-left px-5 py-3 font-medium">Merchant</th>
                <th scope="col" className="text-left px-5 py-3 font-medium">Type</th>
                <th scope="col" className="text-left px-5 py-3 font-medium">Amount</th>
                <th scope="col" className="text-left px-5 py-3 font-medium">Status</th>
                <th scope="col" className="text-left px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((t) => (
                <tr key={t.id} className="border-t border-slate-50">
                  <td className="px-5 py-3 font-mono text-xs text-steel">{t.referenceNumber}</td>
                  <td className="px-5 py-3 card-number text-xs text-steel">{t.maskedNumber}</td>
                  <td className="px-5 py-3 text-ink">{t.merchantName || "—"}</td>
                  <td className="px-5 py-3 text-ink">{t.type}</td>
                  <td className="px-5 py-3 font-mono text-ink">R{t.amount.toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <Badge label={t.status} tone={statusTone(t.status)} />
                  </td>
                  <td className="px-5 py-3 text-xs text-steel">{new Date(t.date).toLocaleString()}</td>
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
    </AppShell>
  );
}
