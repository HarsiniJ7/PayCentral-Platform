import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";

import AdminOverview from "./pages/admin/AdminOverview";
import AdminCards from "./pages/admin/AdminCards";
import AdminCardDetail from "./pages/admin/AdminCardDetail";
import AdminTransactions from "./pages/admin/AdminTransactions";
import AdminSimulate from "./pages/admin/AdminSimulate";
import AdminFraud from "./pages/admin/AdminFraud";
import AdminReports from "./pages/admin/AdminReports";
import AdminAudit from "./pages/admin/AdminAudit";

import CardholderHome from "./pages/cardholder/CardholderHome";
import CardholderTransactions from "./pages/cardholder/CardholderTransactions";
import CardholderNotifications from "./pages/cardholder/CardholderNotifications";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/admin" element={<ProtectedRoute allow={["Administrator"]}><AdminOverview /></ProtectedRoute>} />
      <Route path="/admin/cards" element={<ProtectedRoute allow={["Administrator"]}><AdminCards /></ProtectedRoute>} />
      <Route path="/admin/cards/:id" element={<ProtectedRoute allow={["Administrator"]}><AdminCardDetail /></ProtectedRoute>} />
      <Route path="/admin/transactions" element={<ProtectedRoute allow={["Administrator"]}><AdminTransactions /></ProtectedRoute>} />
      <Route path="/admin/simulate" element={<ProtectedRoute allow={["Administrator"]}><AdminSimulate /></ProtectedRoute>} />
      <Route path="/admin/fraud" element={<ProtectedRoute allow={["Administrator"]}><AdminFraud /></ProtectedRoute>} />
      <Route path="/admin/reports" element={<ProtectedRoute allow={["Administrator"]}><AdminReports /></ProtectedRoute>} />
      <Route path="/admin/audit" element={<ProtectedRoute allow={["Administrator"]}><AdminAudit /></ProtectedRoute>} />

      <Route path="/portal" element={<ProtectedRoute allow={["Cardholder"]}><CardholderHome /></ProtectedRoute>} />
      <Route path="/portal/transactions" element={<ProtectedRoute allow={["Cardholder"]}><CardholderTransactions /></ProtectedRoute>} />
      <Route path="/portal/notifications" element={<ProtectedRoute allow={["Cardholder"]}><CardholderNotifications /></ProtectedRoute>} />

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
