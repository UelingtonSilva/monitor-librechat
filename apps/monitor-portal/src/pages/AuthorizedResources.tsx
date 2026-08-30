import { useTranslation } from "react-i18next";
import { profileLabel } from "@monitor-librechat/shared";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { Page, Card, LoadingState, ErrorState } from "../components/Page.js";
import { PhaseNotice } from "../components/PhaseNotice.js";

export function AuthorizedResources() {
  const { t } = useTranslation();
  const { data, error } = useAsync(() => api.getResources());

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  const mongoUnavailable = data.profiles.every((p) => p.users === 0);

  return (
    <Page title={t("common:nav.resources")} subtitle={t("authorizedResources:subtitle")}>
      <PhaseNotice>
        {t("authorizedResources:liveNoticeBeforeLive")}
        <strong>{t("authorizedResources:liveNoticeLive")}</strong>
        {t("authorizedResources:liveNoticeBeforeConfigs")}
        <code>db.configs</code>
        {t("authorizedResources:liveNoticeAfterConfigs")}
        <code>overrides.modelSpecs</code>
        {t("authorizedResources:liveNoticeAfterOverrides")}
        <code>enforce</code>
        {t("authorizedResources:liveNoticeAfterEnforce")}
      </PhaseNotice>

      {mongoUnavailable && (
        <PhaseNotice>{t("authorizedResources:mongoUnavailableNotice")}</PhaseNotice>
      )}

      <Card title={t("authorizedResources:modelsCardTitle")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2">{t("authorizedResources:columns.profile")}</th>
                <th className="pb-2">{t("authorizedResources:columns.users")}</th>
                <th className="pb-2">{t("authorizedResources:columns.allowedModels")}</th>
                <th className="pb-2">{t("authorizedResources:columns.enforce")}</th>
                <th className="pb-2">{t("authorizedResources:columns.mcp")}</th>
              </tr>
            </thead>
            <tbody>
              {data.profiles.map((p) => (
                <tr key={p.profile} className="border-t border-border align-top">
                  <td className="py-1.5 font-medium">{profileLabel(p.profile)}</td>
                  <td className="py-1.5">{mongoUnavailable ? "—" : p.users}</td>
                  <td className="py-1.5 text-xs">
                    {p.allowedModels.length === 0
                      ? p.profile === "ADMIN"
                        ? t("authorizedResources:allModels")
                        : t("authorizedResources:noRestrictionConfigured")
                      : p.allowedModels.join(", ")}
                  </td>
                  <td className="py-1.5">
                    {p.enforce ? t("authorizedResources:yes") : t("authorizedResources:no")}
                  </td>
                  <td className="py-1.5">
                    {p.mcpAllowed ? t("authorizedResources:yes") : t("authorizedResources:no")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={t("authorizedResources:agentsCardTitle", { count: data.agents.length })}>
          {data.agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("authorizedResources:noAgentsReturned")}
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.agents.map((a) => (
                <li key={a.agentId} className="border-t border-border py-1.5 first:border-0">
                  {a.name}{" "}
                  <span className="font-mono text-xs text-muted-foreground">{a.agentId}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("authorizedResources:mcpIntegrationsTitle")}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2">{t("authorizedResources:mcpColumns.name")}</th>
                <th className="pb-2">{t("authorizedResources:mcpColumns.webSearch")}</th>
              </tr>
            </thead>
            <tbody>
              {data.mcps.map((m) => (
                <tr key={m.mcpId} className="border-t border-border">
                  <td className="py-1.5">{m.name}</td>
                  <td className="py-1.5">
                    {m.webSearch
                      ? t("authorizedResources:webSearchEnabled")
                      : t("authorizedResources:webSearchDisabled")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </Page>
  );
}
