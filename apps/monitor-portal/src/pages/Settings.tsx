import { useTranslation } from "react-i18next";
import { Page, Card } from "../components/Page.js";
import { PhaseNotice } from "../components/PhaseNotice.js";

const RBAC_ROLES = [
  "AI_MANAGER",
  "AI_GOVERNANCE",
  "AI_SECURITY",
  "AI_AUDITOR",
  "AI_ADMIN",
] as const;

export function Settings() {
  const { t } = useTranslation();

  return (
    <Page title={t("settings:title")} subtitle={t("settings:subtitle")}>
      <PhaseNotice>
        {t("settings:phaseNotice.before")}
        <strong>{t("settings:phaseNotice.bold")}</strong>
        {t("settings:phaseNotice.after")}
      </PhaseNotice>

      <Card title={t("settings:rbac.cardTitle")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-2">{t("settings:rbac.columnProfile")}</th>
              <th className="pb-2">{t("settings:rbac.columnAccess")}</th>
            </tr>
          </thead>
          <tbody>
            {RBAC_ROLES.map((profile) => (
              <tr key={profile} className="border-t border-border">
                <td className="py-1.5 font-mono text-xs">{profile}</td>
                <td className="py-1.5">{t(`settings:rbac.roles.${profile}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title={t("settings:config.cardTitle")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-2">{t("settings:config.columnParameter")}</th>
              <th className="pb-2">{t("settings:config.columnWhereDefined")}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border">
              <td className="py-1.5">{t("settings:config.rows.mongoConnection.label")}</td>
              <td className="py-1.5 text-xs">
                <code>MONGO_URI</code> {t("settings:config.rows.mongoConnection.afterCode")}
              </td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-1.5">{t("settings:config.rows.gcpProject.label")}</td>
              <td className="py-1.5 text-xs">
                <code>GOOGLE_CLOUD_PROJECT</code>
              </td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-1.5">{t("settings:config.rows.policyCatalog.label")}</td>
              <td className="py-1.5 text-xs">
                <code>policies/*.yaml</code> {t("settings:config.rows.policyCatalog.afterCode")}
              </td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-1.5">{t("settings:config.rows.modelPricing.label")}</td>
              <td className="py-1.5 text-xs">
                <code>pricing.ts</code> {t("settings:config.rows.modelPricing.afterCode")}
              </td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-1.5">{t("settings:config.rows.modelAllowlist.label")}</td>
              <td className="py-1.5 text-xs">
                <code>resources.ts</code> {t("settings:config.rows.modelAllowlist.betweenCodes")}{" "}
                <code>db.configs</code> {t("settings:config.rows.modelAllowlist.afterCode")}
              </td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-1.5">{t("settings:config.rows.dataRetention.label")}</td>
              <td className="py-1.5 text-xs">{t("settings:config.rows.dataRetention.value")}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </Page>
  );
}
