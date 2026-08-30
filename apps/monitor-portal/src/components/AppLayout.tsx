import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Briefcase,
  TrendingUp,
  ShieldAlert,
  AlertTriangle,
  FileText,
  KeyRound,
  History,
  Settings,
  Activity,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from "lucide-react";
import { api } from "../lib/api.js";

interface NavItem {
  to: string;
  labelKey: string;
  end?: boolean;
  icon: typeof LayoutDashboard;
}

interface NavGroup {
  titleKey: string;
  items: NavItem[];
}

// Grouped by intent: someone checking adoption is not looking for policies, and someone
// investigating an alert should not have to scroll past dashboards to get there.
const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: "common:nav.groupOverview",
    items: [
      { to: "/", labelKey: "common:nav.dashboard", end: true, icon: LayoutDashboard },
      { to: "/adoption", labelKey: "common:nav.adoption", icon: Users },
      { to: "/costs", labelKey: "common:nav.costs", icon: DollarSign },
      { to: "/use-cases", labelKey: "common:nav.useCases", icon: Briefcase },
      { to: "/maturity", labelKey: "common:nav.maturity", icon: TrendingUp },
    ],
  },
  {
    titleKey: "common:nav.groupGovernance",
    items: [
      { to: "/security", labelKey: "common:nav.security", icon: ShieldAlert },
      { to: "/alerts", labelKey: "common:nav.alerts", icon: AlertTriangle },
      { to: "/policies", labelKey: "common:nav.policies", icon: FileText },
      { to: "/resources", labelKey: "common:nav.resources", icon: KeyRound },
    ],
  },
  {
    titleKey: "common:nav.groupPlatform",
    items: [
      { to: "/audit", labelKey: "common:nav.audit", icon: History },
      { to: "/settings", labelKey: "common:nav.settings", icon: Settings },
      { to: "/status", labelKey: "common:nav.status", icon: Activity },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "pt-BR", label: "PT" },
];

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      {LANGUAGES.map((lng) => (
        <button
          key={lng.code}
          onClick={() => i18n.changeLanguage(lng.code)}
          className={`rounded px-1.5 py-0.5 ${
            i18n.resolvedLanguage === lng.code
              ? "bg-muted font-semibold text-foreground"
              : "hover:bg-muted/60"
          }`}
        >
          {lng.label}
        </button>
      ))}
    </div>
  );
}

export function AppLayout({
  user,
  onLogout,
  children,
}: {
  user: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const current =
    ALL_ITEMS.find((i) =>
      i.end ? location.pathname === i.to : location.pathname.startsWith(i.to) && i.to !== "/"
    ) ?? ALL_ITEMS[0];

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={`flex shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-150 ${collapsed ? "w-16" : "w-60"}`}
      >
        <div className="flex h-10 items-center gap-2 border-b border-sidebar-border px-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
            M
          </span>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[10px] uppercase tracking-widest text-sidebar-muted">
                {t("common:eyebrow")}
              </div>
              <div className="truncate text-sm font-semibold">Monitor LibreChat</div>
            </div>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.titleKey} className="flex flex-col gap-0.5">
              {!collapsed && (
                <span className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">
                  {t(group.titleKey)}
                </span>
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={collapsed ? t(item.labelKey) : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm ${
                      isActive
                        ? "sidebar-item-active font-medium"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                    }`
                  }
                >
                  <item.icon size={16} className="shrink-0" />
                  {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-2 border-t border-sidebar-border px-4 py-2.5 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent/40"
        >
          {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
          {!collapsed && t("common:collapse")}
        </button>

        <div className="border-t border-sidebar-border px-4 py-2 text-[10px] text-sidebar-muted">
          {!collapsed && (import.meta.env.VITE_ORG_LABEL || t("common:defaultOrgLabel"))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
          <nav className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <span>Monitor</span>
            <ChevronRight size={14} />
            <span className="truncate font-medium text-foreground">{t(current.labelKey)}</span>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <LanguageSwitcher />
            <span className="hidden text-xs text-muted-foreground sm:inline">{user}</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {initials(user)}
            </span>
            <button
              onClick={onLogout}
              title={t("common:logOut")}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut size={14} />
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-auto p-3">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function useLogoutHandler(onLogout: () => void) {
  return () => api.logout().finally(onLogout);
}
