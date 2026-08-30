import { useTranslation } from "react-i18next";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { Page, Card, LoadingState, ErrorState } from "../components/Page.js";
import { StatCard } from "../components/StatCard.js";
import { SyntheticBanner } from "../components/SyntheticBanner.js";
import { PhaseNotice } from "../components/PhaseNotice.js";
import { SeverityBadge } from "../components/SeverityBadge.js";

export function SecurityRisk() {
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? "en").startsWith("pt") ? "pt-BR" : "en-US";
  const { data, error } = useAsync(() => api.getSecurity());

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  return (
    <Page
      title={t("securityRisk:title")}
      subtitle={t("securityRisk:subtitle", {
        mode: data.mode,
        count: data.totalMessagesScanned,
        formattedCount: data.totalMessagesScanned.toLocaleString(locale),
      })}
    >
      {data.synthetic && <SyntheticBanner />}

      <PhaseNotice>
        {t("securityRisk:phaseNotice.introBeforeMode")}{" "}
        <strong>{t("securityRisk:phaseNotice.mode")}</strong>
        {t("securityRisk:phaseNotice.afterModeBeforeBlocked")}{" "}
        <strong>{t("securityRisk:phaseNotice.nothingBlocked")}</strong>{" "}
        {t("securityRisk:phaseNotice.afterBlocked")}{" "}
        {t("securityRisk:phaseNotice.deterministicOnly")}{" "}
        {t("securityRisk:phaseNotice.semanticPending")}
      </PhaseNotice>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label={t("securityRisk:statCritical")} value={data.bySeverity.critical} />
        <StatCard label={t("securityRisk:statHigh")} value={data.bySeverity.high} />
        <StatCard label={t("securityRisk:statMedium")} value={data.bySeverity.medium} />
        <StatCard label={t("securityRisk:statLow")} value={data.bySeverity.low} />
        <StatCard label={t("securityRisk:statInfo")} value={data.bySeverity.info} />
      </section>

      <Card title={t("securityRisk:detectionsCardTitle", { count: data.alerts.length })}>
        {data.alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("securityRisk:noDetectionsMessage")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2">{t("securityRisk:colDate")}</th>
                  <th className="pb-2">{t("securityRisk:colSeverity")}</th>
                  <th className="pb-2">{t("securityRisk:colPolicy")}</th>
                  <th className="pb-2">{t("securityRisk:colUser")}</th>
                  <th className="pb-2">{t("securityRisk:colEvidence")}</th>
                  <th className="pb-2">{t("securityRisk:colDecision")}</th>
                </tr>
              </thead>
              <tbody>
                {data.alerts.map((alert, i) => (
                  <tr key={`${alert.policyId}-${i}`} className="border-t border-border">
                    <td className="py-1.5 whitespace-nowrap">
                      {new Date(alert.timestamp).toLocaleString(locale)}
                    </td>
                    <td className="py-1.5">
                      <SeverityBadge severity={alert.severity} />
                    </td>
                    <td className="py-1.5">
                      <span className="font-mono text-xs">{alert.policyId}</span> {alert.policyName}
                    </td>
                    <td className="py-1.5 font-mono text-xs">{alert.subjectRef}</td>
                    <td className="py-1.5 font-mono text-xs">{alert.evidenceMasked}</td>
                    <td className="py-1.5">{alert.decision}</td>
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
