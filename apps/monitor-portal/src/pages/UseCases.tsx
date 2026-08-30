import { useTranslation } from "react-i18next";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { Page, Card, LoadingState, ErrorState } from "../components/Page.js";
import { PhaseNotice } from "../components/PhaseNotice.js";
import { SyntheticBanner } from "../components/SyntheticBanner.js";

export function UseCases() {
  const { data, error } = useAsync(() => api.getUsage());
  const { t, i18n } = useTranslation();

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  const locale = (i18n.resolvedLanguage ?? "en").startsWith("pt") ? "pt-BR" : "en-US";

  return (
    <Page title={t("useCases:title")} subtitle={t("useCases:subtitle")}>
      {data.synthetic && <SyntheticBanner />}

      <PhaseNotice>
        {t("useCases:phaseNoticeIntro")}
        <strong>{t("useCases:phaseNoticePurposeLabel")}</strong>
        {t("useCases:phaseNoticeMiddle")}
        <strong>{t("useCases:phaseNoticeCategoryLabel")}</strong>
        {t("useCases:phaseNoticeExplanation")}
        <br />
        <br />
        {t("useCases:phaseNoticeFollowUp")}
      </PhaseNotice>

      <Card title={t("useCases:agentTableTitle")}>
        {data.byAgent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("useCases:agentTableEmpty")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2">{t("useCases:colAgent")}</th>
                <th className="pb-2">{t("useCases:colUses")}</th>
                <th className="pb-2">{t("useCases:colShare")}</th>
              </tr>
            </thead>
            <tbody>
              {data.byAgent.map((a) => {
                const total = data.byAgent.reduce((s, x) => s + x.uses, 0);
                return (
                  <tr key={a.agentId} className="border-t border-border">
                    <td className="py-1.5">{a.name}</td>
                    <td className="py-1.5">{a.uses}</td>
                    <td className="py-1.5">
                      {total > 0
                        ? `${((a.uses / total) * 100).toFixed(0)}%`
                        : t("useCases:noShareValue")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={t("useCases:volumeTitle")}>
        <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">{t("useCases:colConversations")}</dt>
            <dd className="text-lg font-semibold">
              {data.totalConversations.toLocaleString(locale)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("useCases:colPrompts")}</dt>
            <dd className="text-lg font-semibold">{data.totalPrompts.toLocaleString(locale)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("useCases:colInputTokens")}</dt>
            <dd className="text-lg font-semibold">{data.inputTokens.toLocaleString(locale)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("useCases:colOutputTokens")}</dt>
            <dd className="text-lg font-semibold">{data.outputTokens.toLocaleString(locale)}</dd>
          </div>
        </dl>
      </Card>
    </Page>
  );
}
