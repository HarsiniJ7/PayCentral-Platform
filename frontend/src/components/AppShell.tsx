import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ThemeToggle } from "./ThemeToggle";

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ICONS = {
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  card: "M3 6h18v12H3zM3 10h18",
  list: "M4 6h16M4 12h16M4 18h10",
  alert: "M12 9v4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z",
  report: "M9 17v-6M12 17v-10M15 17v-3M5 21h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z",
  log: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
};

export function AppShell({ children, navItems, title }: { children: ReactNode; navItems: NavItem[]; title: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex bg-paper dark:bg-ink transition-colors">
      <aside className="w-64 bg-ink-gradient text-mist flex flex-col shrink-0 relative">
        <div className="absolute inset-0 pointer-events-none opacity-40" style={{
          backgroundImage: "radial-gradient(circle at 20% 0%, rgba(31,174,138,0.25), transparent 40%)"
        }} />
        <div className="px-6 py-6 border-b border-white/10 relative">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-brand-gradient shadow-glow flex items-center justify-center font-display font-bold text-ink text-sm">
                P
              </div>
              <div className="font-display text-xl font-semibold text-white tracking-tight">PayCentral</div>
            </div>
            <ThemeToggle />
          </div>
          <div className="text-xs text-steel mt-2 uppercase tracking-wide">{title}</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 relative">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin" || item.to === "/portal"}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-white/10 text-white shadow-[inset_2px_0_0_0_#1FAE8A]"
                    : "text-mist hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? "text-signal2" : "text-steel group-hover:text-mist"}>{item.icon}</span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10 relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-brand-gradient flex items-center justify-center text-ink font-display font-semibold text-sm shrink-0">
              {user?.fullName?.charAt(0) ?? "U"}
            </div>
            <div className="min-w-0">
              <div className="text-sm text-white font-medium truncate">{user?.fullName}</div>
              <div className="text-xs text-steel truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="w-full text-sm text-mist hover:text-white font-medium border border-white/10 hover:border-white/20 rounded-lg py-2 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-paper dark:bg-ink transition-colors">
        <div className="max-w-7xl mx-auto px-8 py-8 animate-fadeUp">{children}</div>
      </main>
    </div>
  );
}

export const ADMIN_NAV: NavItem[] = [
  { label: "Overview", to: "/admin", icon: <Icon d={ICONS.grid} /> },
  { label: "Cardholders & Cards", to: "/admin/cards", icon: <Icon d={ICONS.card} /> },
  { label: "Transactions", to: "/admin/transactions", icon: <Icon d={ICONS.list} /> },
  { label: "Simulate Transaction", to: "/admin/simulate", icon: <Icon d={ICONS.bell} /> },
  { label: "Fraud Alerts", to: "/admin/fraud", icon: <Icon d={ICONS.alert} /> },
  { label: "Reports", to: "/admin/reports", icon: <Icon d={ICONS.report} /> },
  { label: "Audit Log", to: "/admin/audit", icon: <Icon d={ICONS.log} /> },
];

export const CARDHOLDER_NAV: NavItem[] = [
  { label: "My Card", to: "/portal", icon: <Icon d={ICONS.card} /> },
  { label: "Transactions", to: "/portal/transactions", icon: <Icon d={ICONS.list} /> },
  { label: "Notifications", to: "/portal/notifications", icon: <Icon d={ICONS.bell} /> },
];
