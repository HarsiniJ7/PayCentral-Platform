import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";

interface Cardholder {
  id: string;
  fullName: string;
  email: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function IssueCardModal({ onClose, onIssued }: { onClose: () => void; onIssued: () => void }) {
  const [cardholders, setCardholders] = useState<Cardholder[]>([]);
  const [cardholderId, setCardholderId] = useState("");
  const [initialBalance, setInitialBalance] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    api.get<{ data: Cardholder[] }>("/users/cardholders").then((r) => setCardholders(r.data));
  }, []);

  // Accessibility: move focus into the dialog on open, trap Tab/Shift+Tab
  // within it while open, restore focus to the trigger element on close, and
  // let Escape close it - the standard expectations for a modal dialog
  // (WAI-ARIA Authoring Practices "Dialog (Modal)" pattern).
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cardholderId) {
      setError("Please choose a cardholder.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/cards", { cardholderId, initialBalance: parseFloat(initialBalance) || 0 });
      onIssued();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="issue-card-title"
        aria-describedby="issue-card-description"
        className="bg-white dark:bg-panel rounded-xl shadow-xl w-full max-w-md p-6"
      >
        <h2 id="issue-card-title" className="font-display text-lg font-semibold text-ink dark:text-white mb-1">
          Issue a new card
        </h2>
        <p id="issue-card-description" className="text-sm text-steel mb-5">
          Choose a cardholder and set a starting balance.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="issue-card-cardholder" className="block text-sm font-medium text-ink dark:text-mist mb-1.5">
              Cardholder
            </label>
            <select
              id="issue-card-cardholder"
              ref={firstFieldRef}
              value={cardholderId}
              onChange={(e) => setCardholderId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-white/15 dark:bg-ink dark:text-mist text-sm outline-none focus:border-signal focus:ring-1 focus:ring-signal"
            >
              <option value="">Select a cardholder...</option>
              {cardholders.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} ({c.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="issue-card-balance" className="block text-sm font-medium text-ink dark:text-mist mb-1.5">
              Initial balance (ZAR)
            </label>
            <input
              id="issue-card-balance"
              type="number"
              min="0"
              step="0.01"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-white/15 dark:bg-ink dark:text-mist text-sm outline-none focus:border-signal focus:ring-1 focus:ring-signal"
            />
          </div>

          {error && (
            <div role="alert" className="text-sm text-coral bg-coral/10 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-steel hover:text-ink dark:hover:text-white"
            >
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary text-sm">
              {submitting ? "Issuing..." : "Issue card"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
