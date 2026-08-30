import { useTranslation } from "react-i18next";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { Page, Card, LoadingState, ErrorState } from "../components/Page.js";
import { StatCard } from "../components/StatCard.js";

function formatUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

const FEATURE_NAME_KEYS: Record<string, string> = {
  "cost-pipeline": "operationalStatus:featureNames.costPipeline",
  "mcp-audit": "operationalStatus:featureNames.mcpAudit",
  "mcp-integrations": "operationalStatus:featureNames.mcpIntegrations",
};

export function OperationalStatus() {
  const { t } = useTranslation();
  const { data, error } = useAsync(() => api.getStatus());

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  return (
    <Page title={t("operationalStatus:title")} subtitle={t("operationalStatus:subtitle")}>
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label={t("operationalStatus:overallStatus")} value={data.status.toUpperCase()} />
        <StatCard
          label={t("operationalStatus:mongoLabel")}
          value={
            data.mongoConnected
              ? t("operationalStatus:mongoConnected")
              : t("operationalStatus:mongoNotConfigured")
          }
          hint={
            data.mongoConnected
              ? undefined
              : data.mongoError
                ? `${data.mongoError} — ${t("operationalStatus:syntheticDataHint")}`
                : t("operationalStatus:syntheticDataHint")
          }
        />
        <StatCard label={t("operationalStatus:version")} value={data.version} />
        <StatCard label={t("operationalStatus:uptime")} value={formatUptime(data.uptimeSec)} />
      </section>

      <Card title={t("operationalStatus:sloSectionTitle")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-2">{t("operationalStatus:columnSlo")}</th>
              <th className="pb-2">{t("operationalStatus:columnTarget")}</th>
              <th className="pb-2">{t("operationalStatus:columnNote")}</th>
            </tr>
          </thead>
          <tbody>
            {data.sloTargets.map((slo) => (
              <tr key={slo.name} className="border-t border-border align-top">
                <td className="py-1.5">{slo.name}</td>
                <td className="py-1.5 whitespace-nowrap">{slo.target}</td>
                <td className="py-1.5 text-xs text-muted-foreground">{slo.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title={t("operationalStatus:featureSectionTitle")}>
        <p className="mb-2 text-xs text-muted-foreground">
          {t("operationalStatus:featureSectionHint")}
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-2">{t("operationalStatus:columnFeature")}</th>
              <th className="pb-2">{t("operationalStatus:columnStatus")}</th>
              <th className="pb-2">{t("operationalStatus:columnDetails")}</th>
            </tr>
          </thead>
          <tbody>
            {data.featureStatus.map((f) => (
              <tr key={f.feature} className="border-t border-border align-top">
                <td className="py-1.5">{t(FEATURE_NAME_KEYS[f.feature] ?? f.feature)}</td>
                <td className="py-1.5">
                  <span
                    className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                      f.enabled ? "status-active" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {f.enabled
                      ? t("operationalStatus:featureEnabled")
                      : t("operationalStatus:featureOff")}
                  </span>
                </td>
                <td className="py-1.5 text-xs text-muted-foreground">{f.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {data.schemaChecks.length > 0 && (
        <Card title={t("operationalStatus:schemaSectionTitle")}>
          <p className="mb-2 text-xs text-muted-foreground">
            {t("operationalStatus:schemaSectionHint")}
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2">{t("operationalStatus:columnCollection")}</th>
                <th className="pb-2">{t("operationalStatus:columnStatus")}</th>
                <th className="pb-2">{t("operationalStatus:columnDetails")}</th>
              </tr>
            </thead>
            <tbody>
              {data.schemaChecks.map((check) => (
                <tr key={check.collection} className="border-t border-border align-top">
                  <td className="py-1.5 font-mono text-xs">{check.collection}</td>
                  <td className="py-1.5">
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                        check.ok ? "status-active" : "status-warning"
                      }`}
                    >
                      {check.ok
                        ? t("operationalStatus:schemaOk")
                        : t("operationalStatus:schemaDrift")}
                    </span>
                  </td>
                  <td className="py-1.5 text-xs text-muted-foreground">
                    {check.note}
                    {check.missingFields.length > 0 && (
                      <div>
                        {t("operationalStatus:missingFields")}: {check.missingFields.join(", ")}
                      </div>
                    )}
                    {Object.entries(check.unexpectedValues).map(([field, values]) => (
                      <div key={field}>
                        {t("operationalStatus:unexpectedValues", { field })}: {values.join(", ")}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </Page>
  );
}
