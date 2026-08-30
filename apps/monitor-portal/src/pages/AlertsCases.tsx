import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { Page, Card, LoadingState, ErrorState } from "../components/Page.js";
import { StatCard } from "../components/StatCard.js";
import { PhaseNotice } from "../components/PhaseNotice.js";
import { SyntheticBanner } from "../components/SyntheticBanner.js";
import { SeverityBadge } from "../components/SeverityBadge.js";

const SEVERITIES = ["todas", "critical", "high", "medium", "low", "info"] as const;

export function AlertsCases() {
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? "en").startsWith("pt") ? "pt-BR" : "en-US";
  const { data, error } = useAsync(() => api.getSecurity());
  const [severityFilter, setSeverityFilter] = useState<(typeof SEVERITIES)[number]>("todas");
  const [policyFilter, setPolicyFilter] = useState("todas");

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  const policies = ["todas", ...new Set(data.alerts.map((a) => a.policyId))];
  const filtered = data.alerts.filter(
    (a) =>
      (severityFilter === "todas" || a.severity === severityFilter) &&
      (policyFilter === "todas" || a.policyId === policyFilter)
  );

  const criticalAndHigh = data.bySeverity.critical + data.bySeverity.high;

  return (
    <Page title={t("alertsCases:title")} subtitle={t("alertsCases:subtitle")}>
      {data.synthetic && <SyntheticBanner />}

      <PhaseNotice>
        {t("alertsCases:phaseNoticeIntro")} <strong>{t("alertsCases:phaseNoticeReadOnly")}</strong>{" "}
        {t("alertsCases:phaseNoticeBody")}
      </PhaseNotice>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label={t("alertsCases:statAlertsInPeriod")} value={data.alerts.length} />
        <StatCard
          label={t("alertsCases:statCriticalHigh")}
          value={criticalAndHigh}
          hint={t("alertsCases:hintTriagePriority")}
        />
        <StatCard
          label={t("alertsCases:statMessagesScanned")}
          value={data.totalMessagesScanned.toLocaleString(locale)}
        />
        <StatCard
          label={t("alertsCases:statMode")}
          value={data.mode}
          hint={t("alertsCases:hintModeIsBlocked")}
        />
      </section>

      <Card title={t("alertsCases:filtersTitle")}>
        <div className="flex flex-wrap gap-4">
          <label className="text-sm">
            <span className="mr-2 text-muted-foreground">{t("alertsCases:severityLabel")}</span>
            <select
              className="rounded border border-border px-2 py-1"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as (typeof SEVERITIES)[number])}
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s === "todas" ? t("alertsCases:filterAll") : s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mr-2 text-muted-foreground">{t("alertsCases:policyLabel")}</span>
            <select
              className="rounded border border-border px-2 py-1"
              value={policyFilter}
              onChange={(e) => setPolicyFilter(e.target.value)}
            >
              {policies.map((p) => (
                <option key={p} value={p}>
                  {p === "todas" ? t("alertsCases:filterAll") : p}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card title={t("alertsCases:alertsCountTitle", { count: filtered.length })}>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("alertsCases:noAlertsMatchFilters")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2">{t("alertsCases:colDate")}</th>
                  <th className="pb-2">{t("alertsCases:colSeverity")}</th>
                  <th className="pb-2">{t("alertsCases:colPolicy")}</th>
                  <th className="pb-2">{t("alertsCases:colUser")}</th>
                  <th className="pb-2">{t("alertsCases:colEvidenceMasked")}</th>
                  <th className="pb-2">{t("alertsCases:colDecision")}</th>
                  <th className="pb-2">{t("alertsCases:colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => (
                  <tr key={`${a.policyId}-${i}`} className="border-t border-border">
                    <td className="py-1.5 whitespace-nowrap">
                      {new Date(a.timestamp).toLocaleString(locale)}
                    </td>
                    <td className="py-1.5">
                      <SeverityBadge severity={a.severity} />
                    </td>
                    <td className="py-1.5">
                      <span className="font-mono text-xs">{a.policyId}</span> {a.policyName}
                    </td>
                    <td className="py-1.5 font-mono text-xs">{a.subjectRef}</td>
                    <td className="py-1.5 font-mono text-xs">{a.evidenceMasked}</td>
                    <td className="py-1.5">{a.decision}</td>
                    <td className="py-1.5 text-muted-foreground">{t("alertsCases:statusNew")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  );
}
