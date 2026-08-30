import { useTranslation } from "react-i18next";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { Page, Card, LoadingState, ErrorState } from "../components/Page.js";
import { PhaseNotice } from "../components/PhaseNotice.js";
import { SyntheticBanner } from "../components/SyntheticBanner.js";

export function AuditTrail() {
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? "en").startsWith("pt") ? "pt-BR" : "en-US";
  const audit = useAsync(() => api.getAudit());
  const mcp = useAsync(() => api.getMcpAudit());

  if (audit.error) return <ErrorState message={audit.error} />;
  if (!audit.data) return <LoadingState />;

  return (
    <Page title={t("common:nav.audit")} subtitle={t("auditTrail:pageSubtitle")}>
      <PhaseNotice>{audit.data.note}</PhaseNotice>

      <Card title={t("auditTrail:mcpQueriesTitle", { count: mcp.data?.entries.length ?? 0 })}>
        {!mcp.data ? (
          <LoadingState />
        ) : (
          <>
            {mcp.data.synthetic && <SyntheticBanner />}
            {mcp.data.entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("auditTrail:noMcpQueries")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-2">{t("auditTrail:mcpTable.date")}</th>
                      <th className="pb-2">{t("auditTrail:mcpTable.service")}</th>
                      <th className="pb-2">{t("auditTrail:mcpTable.user")}</th>
                      <th className="pb-2">{t("auditTrail:mcpTable.action")}</th>
                      <th className="pb-2">{t("auditTrail:mcpTable.resource")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mcp.data.entries.map((e, i) => (
                      <tr key={`${e.timestamp}-${i}`} className="border-t border-border">
                        <td className="py-1.5 whitespace-nowrap">
                          {new Date(e.timestamp).toLocaleString(locale)}
                        </td>
                        <td className="py-1.5 font-mono text-xs">{e.service}</td>
                        <td className="py-1.5 font-mono text-xs">{e.subjectRef}</td>
                        <td className="py-1.5">{e.action}</td>
                        <td className="py-1.5">{e.resource ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>

      <Card title={t("auditTrail:monitorAccessTitle", { count: audit.data.entries.length })}>
        {audit.data.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("auditTrail:noMonitorAccess")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2">{t("auditTrail:accessTable.date")}</th>
                  <th className="pb-2">{t("auditTrail:accessTable.method")}</th>
                  <th className="pb-2">{t("auditTrail:accessTable.route")}</th>
                  <th className="pb-2">{t("auditTrail:accessTable.status")}</th>
                  <th className="pb-2">{t("auditTrail:accessTable.duration")}</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.entries.slice(0, 50).map((e) => (
                  <tr key={e.correlationId} className="border-t border-border">
                    <td className="py-1.5 whitespace-nowrap">
                      {new Date(e.timestamp).toLocaleString(locale)}
                    </td>
                    <td className="py-1.5">{e.method}</td>
                    <td className="py-1.5 font-mono text-xs">{e.path}</td>
                    <td className="py-1.5">{e.statusCode}</td>
                    <td className="py-1.5">
                      {e.durationMs} {t("auditTrail:durationUnit")}
                    </td>
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
