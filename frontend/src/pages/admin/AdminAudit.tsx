import { useEffect, useState } from "react";
import { AppShell, ADMIN_NAV } from "../../components/AppShell";
import { Pagination, LoadingRows, EmptyState } from "../../components/Common";
import { api } from "../../api/client";
import type { AuditLogEntry, PaginatedResponse } from "../../types";

export default function AdminAudit() {
  const [result, setResult] = useState<PaginatedResponse<AuditLogEntry> | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get<PaginatedResponse<AuditLogEntry>>(`/audit-logs?page=${page}&pageSize=15`).then(setResult);
  }, [page]);

  return (
    <AppShell navItems={ADMIN_NAV} title="Administrator">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Audit Log</h1>
        <p className="text-steel text-sm mt-1">A trail of every sensitive action taken on the platform, for POPIA and compliance purposes.</p>
      </header>

      <div className="surface-card overflow-hidden">
        {!result ? (
          <div className="p-5">
            <LoadingRows rows={8} />
          </div>
        ) : result.data.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No audit entries yet" message="Actions like issuing cards or changing status will appear here." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-steel text-xs uppercase tracking-wide">
              <tr>
                <th scope="col" className="text-left px-5 py-3 font-medium">Action</th>
                <th scope="col" className="text-left px-5 py-3 font-medium">Actor</th>
                <th scope="col" className="text-left px-5 py-3 font-medium">Entity</th>
                <th scope="col" className="text-left px-5 py-3 font-medium">Details</th>
                <th scope="col" className="text-left px-5 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((a) => (
                <tr key={a.id} className="border-t border-slate-50">
                  <td className="px-5 py-3 text-ink font-medium">{a.action}</td>
                  <td className="px-5 py-3 text-steel">{a.actorName || "System"}</td>
                  <td className="px-5 py-3 text-steel">{a.entityType}</td>
                  <td className="px-5 py-3 text-steel">{a.details || "—"}</td>
                  <td className="px-5 py-3 text-xs text-steel">{new Date(a.createdAt).toLocaleString()}</td>
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
