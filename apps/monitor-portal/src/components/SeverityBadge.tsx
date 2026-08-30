import { useTranslation } from "react-i18next";

const CLASS_NAME: Record<string, string> = {
  critical: "status-error",
  high: "status-warning",
  medium: "status-warning",
  low: "bg-muted text-muted-foreground",
  info: "status-active",
};

const LABEL_KEY: Record<string, string> = {
  critical: "common:severity.critical",
  high: "common:severity.high",
  medium: "common:severity.medium",
  low: "common:severity.low",
  info: "common:severity.info",
};

export function SeverityBadge({ severity }: { severity: string }) {
  const { t } = useTranslation();
  const className = CLASS_NAME[severity] ?? CLASS_NAME.low;
  const labelKey = LABEL_KEY[severity] ?? LABEL_KEY.low;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {t(labelKey)}
    </span>
  );
}
