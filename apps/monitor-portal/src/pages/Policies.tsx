import { useTranslation, Trans } from "react-i18next";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { Page, Card, LoadingState, ErrorState } from "../components/Page.js";
import { StatCard } from "../components/StatCard.js";
import { PhaseNotice } from "../components/PhaseNotice.js";
import { SeverityBadge } from "../components/SeverityBadge.js";

export function Policies() {
  const { t } = useTranslation();
  const { data, error } = useAsync(() => api.getPolicies());

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  const active = data.policies.filter((p) => p.implemented);
  const pending = data.policies.filter((p) => !p.implemented);

  return (
    <Page title={t("policies:title")} subtitle={t("policies:subtitle")}>
      <PhaseNotice>
        <Trans i18nKey="policies:phaseNotice" components={{ strong: <strong /> }} />
      </PhaseNotice>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label={t("policies:statCatalogPolicies")} value={data.policies.length} />
        <StatCard label={t("policies:statActive")} value={active.length} />
        <StatCard label={t("policies:statPendingPhase")} value={pending.length} />
      </section>

      <Card title={t("policies:activeCardTitle", { count: active.length })}>
        <PolicyTable policies={active} />
      </Card>

      <Card title={t("policies:pendingCardTitle", { count: pending.length })}>
        <PolicyTable policies={pending} />
      </Card>
    </Page>
  );
}

function PolicyTable({
  policies,
}: {
  policies: Awaited<ReturnType<typeof api.getPolicies>>["policies"];
}) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="pb-2">{t("policies:colId")}</th>
            <th className="pb-2">{t("policies:colName")}</th>
            <th className="pb-2">{t("policies:colDomain")}</th>
            <th className="pb-2">{t("policies:colSeverity")}</th>
            <th className="pb-2">{t("policies:colMode")}</th>
            <th className="pb-2">{t("policies:colDetection")}</th>
            <th className="pb-2">{t("policies:colNote")}</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((p) => (
            <tr key={p.id} className="border-t border-border align-top">
              <td className="py-1.5 font-mono text-xs whitespace-nowrap">{p.id}</td>
              <td className="py-1.5">{p.name}</td>
              <td className="py-1.5">{p.domain}</td>
              <td className="py-1.5">
                <SeverityBadge severity={p.severity} />
              </td>
              <td className="py-1.5 uppercase text-xs">{p.mode}</td>
              <td className="py-1.5 text-xs">{p.detection}</td>
              <td className="py-1.5 text-xs text-muted-foreground">{p.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
