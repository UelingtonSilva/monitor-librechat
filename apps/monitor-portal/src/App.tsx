import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { api, Unauthenticated } from "./lib/api.js";
import { AppLayout, useLogoutHandler } from "./components/AppLayout.js";
import { Login } from "./pages/Login.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Adoption } from "./pages/Adoption.js";
import { Costs } from "./pages/Costs.js";
import { UseCases } from "./pages/UseCases.js";
import { Maturity } from "./pages/Maturity.js";
import { SecurityRisk } from "./pages/SecurityRisk.js";
import { AlertsCases } from "./pages/AlertsCases.js";
import { Policies } from "./pages/Policies.js";
import { AuthorizedResources } from "./pages/AuthorizedResources.js";
import { AuditTrail } from "./pages/AuditTrail.js";
import { Settings } from "./pages/Settings.js";
import { OperationalStatus } from "./pages/OperationalStatus.js";

export default function App() {
  const { t } = useTranslation();
  const [user, setUser] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  // Sessions expire after eight hours. If any call returns 401, fall back to the login screen
  // rather than leaving a broken page showing a load error.
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      if (e.reason instanceof Unauthenticated) setUser(null);
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  const logout = useLogoutHandler(() => setUser(null));

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">{t("common:loading")}</p>
      </div>
    );
  }

  if (!user) return <Login onLogin={setUser} />;

  return (
    <BrowserRouter basename="/monitor">
      <AppLayout user={user} onLogout={logout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/adoption" element={<Adoption />} />
          <Route path="/costs" element={<Costs />} />
          <Route path="/use-cases" element={<UseCases />} />
          <Route path="/maturity" element={<Maturity />} />
          <Route path="/security" element={<SecurityRisk />} />
          <Route path="/alerts" element={<AlertsCases />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/resources" element={<AuthorizedResources />} />
          <Route path="/audit" element={<AuditTrail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/status" element={<OperationalStatus />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
