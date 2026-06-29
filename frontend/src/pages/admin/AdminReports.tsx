import { useState } from "react";
import { AppShell, ADMIN_NAV } from "../../components/AppShell";
import { downloadReport } from "../../api/client";

const REPORTS = [
  { key: "transactions", label: "Transaction Report", description: "Every transaction across all cards." },
  { key: "fraud", label: "Fraud Report", description: "All fraud alerts raised by the rule engine." },
  { key: "cards", label: "Card Report", description: "Card status, balances and ownership." },
  { key: "daily-summary", label: "Daily Summary", description: "Spend, loads and declines grouped by day." },
];

export default function AdminReports() {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleDownload(key: string, format: "csv" | "json") {
    setDownloading(`${key}-${format}`);
    try {
      await downloadReport(`/reports/${key}?format=${format}`, `${key}-report.${format}`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <AppShell navItems={ADMIN_NAV} title="Administrator">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Reports</h1>
        <p className="text-steel text-sm mt-1">Export platform data for finance, compliance or audit purposes.</p>
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        {REPORTS.map((r) => (
          <div key={r.key} className="surface-card p-5">
            <h2 className="font-display font-semibold text-ink mb-1">{r.label}</h2>
            <p className="text-sm text-steel mb-4">{r.description}</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleDownload(r.key, "csv")}
                disabled={downloading === `${r.key}-csv`}
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                {downloading === `${r.key}-csv` ? "Preparing..." : "Export CSV"}
              </button>
              <button
                onClick={() => handleDownload(r.key, "json")}
                disabled={downloading === `${r.key}-json`}
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                {downloading === `${r.key}-json` ? "Preparing..." : "Export JSON"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
