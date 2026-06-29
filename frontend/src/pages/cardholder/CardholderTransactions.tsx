import { useEffect, useState } from "react";
import { AppShell, CARDHOLDER_NAV } from "../../components/AppShell";
import { Badge, statusTone } from "../../components/Badge";
import { Pagination, LoadingRows, EmptyState } from "../../components/Common";
import { api } from "../../api/client";
import type { PaginatedResponse, Transaction } from "../../types";

export default function CardholderTransactions() {
  const [result, setResult] = useState<PaginatedResponse<Transaction> | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get<PaginatedResponse<Transaction>>(`/transactions?page=${page}&pageSize=10`).then(setResult);
  }, [page]);

  return (
    <AppShell navItems={CARDHOLDER_NAV} title="Cardholder">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Transactions</h1>
        <p className="text-steel text-sm mt-1">Every purchase, load and refund on your card.</p>
      </header>

      <div className="surface-card overflow-hidden">
        {!result ? (
          <div className="p-5">
            <LoadingRows rows={6} />
          </div>
        ) : result.data.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No transactions yet" message="Your purchases and loads will show up here." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-steel text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Merchant</th>
                <th className="text-left px-5 py-3 font-medium">Type</th>
                <th className="text-left px-5 py-3 font-medium">Amount</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-left px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((t) => (
                <tr key={t.id} className="border-t border-slate-50">
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
