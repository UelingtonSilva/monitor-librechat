import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";

interface PageProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function Page({ title, subtitle, children }: PageProps) {
  return (
    <div className="flex flex-col gap-3">
      <header className="page-header">
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </header>
      {children}
    </div>
  );
}

export function LoadingState() {
  const { t } = useTranslation();
  return <p className="text-sm text-muted-foreground">{t("common:loading")}</p>;
}

export function ErrorState({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>{t("common:errorLoading", { message })}</span>
    </div>
  );
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col rounded-lg border border-border bg-card shadow-sm">
      <h2 className="eyebrow border-b border-border px-3 py-1.5">{title}</h2>
      <div className="p-3">{children}</div>
    </section>
  );
}

/** Table with its own horizontal scroll, so the page body never scrolls sideways. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-1 overflow-x-auto px-1">{children}</div>;
}
