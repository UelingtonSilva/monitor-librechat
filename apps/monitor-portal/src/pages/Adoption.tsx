import { useTranslation } from "react-i18next";
import { profileLabel } from "@monitor-librechat/shared";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { Page, Card, LoadingState, ErrorState } from "../components/Page.js";
import { StatCard } from "../components/StatCard.js";
import { SyntheticBanner } from "../components/SyntheticBanner.js";
import { LineChart } from "../components/LineChart.js";

export function Adoption() {
  const { t, i18n } = useTranslation();
  const adoption = useAsync(() => api.getAdoption());
  const trend = useAsync(() => api.getAdoptionTrend());

  if (adoption.error) return <ErrorState message={adoption.error} />;
  if (!adoption.data) return <LoadingState />;

  const a = adoption.data;
  const locale = (i18n.resolvedLanguage ?? "en").startsWith("pt") ? "pt-BR" : "en-US";

  return (
    <Page
      title={t("adoption:title")}
      subtitle={t("adoption:subtitle", {
        start: new Date(a.periodStart).toLocaleDateString(locale),
        end: new Date(a.periodEnd).toLocaleDateString(locale),
      })}
    >
      {a.synthetic && <SyntheticBanner />}

      <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label={t("adoption:stats.enabledUsers")} value={a.enabledUsers} />
        <StatCard
          label={t("adoption:stats.dau")}
          value={a.dau}
          hint={t("adoption:stats.dauHint")}
        />
        <StatCard
          label={t("adoption:stats.wau")}
          value={a.wau}
          hint={t("adoption:stats.wauHint")}
        />
        <StatCard
          label={t("adoption:stats.mau")}
          value={a.mau}
          hint={t("adoption:stats.mauHint")}
        />
        <StatCard
          label={t("adoption:stats.activationRate")}
          value={`${(a.activationRate * 100).toFixed(0)}%`}
        />
      </section>

      <Card title={t("adoption:dailyActiveCard.title")}>
        {trend.data ? (
          <LineChart
            points={trend.data.dauSeries}
            label={t("adoption:dailyActiveCard.chartLabel")}
          />
        ) : (
          <LoadingState />
        )}
      </Card>

      <Card title={t("adoption:byProfileCard.title")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-2">{t("adoption:byProfileCard.columns.profile")}</th>
              <th className="pb-2">{t("adoption:byProfileCard.columns.enabled")}</th>
              <th className="pb-2">{t("adoption:byProfileCard.columns.activeInPeriod")}</th>
              <th className="pb-2">{t("adoption:byProfileCard.columns.rate")}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(a.byProfile).map(([profile, stats]) => (
              <tr key={profile} className="border-t border-border">
                <td className="py-1.5">{profileLabel(profile)}</td>
                <td className="py-1.5">{stats.enabled}</td>
                <td className="py-1.5">{stats.activeInPeriod}</td>
                <td className="py-1.5">
                  {stats.enabled > 0
                    ? `${((stats.activeInPeriod / stats.enabled) * 100).toFixed(0)}%`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Page>
  );
}
