import { profileLabel } from "@monitor-librechat/shared";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api.js";
import { useAsync } from "../lib/useAsync.js";
import { Page, Card, LoadingState, ErrorState } from "../components/Page.js";
import { StatCard } from "../components/StatCard.js";
import { SyntheticBanner } from "../components/SyntheticBanner.js";
import { PhaseNotice } from "../components/PhaseNotice.js";
import { LineChart } from "../components/LineChart.js";

export function Costs() {
  const { t, i18n } = useTranslation();
  const cost = useAsync(() => api.getCost());
  const trend = useAsync(() => api.getCostTrend());

  if (cost.error) return <ErrorState message={cost.error} />;
  if (!cost.data) return <LoadingState />;

  const c = cost.data;
  const locale = (i18n.resolvedLanguage ?? "en").startsWith("pt") ? "pt-BR" : "en-US";
  const money = (v: number) =>
    c.currency === "USD" ? `US$ ${v.toFixed(2)}` : `R$ ${v.toFixed(2)}`;
  const topProfile = Object.entries(c.byProfile).sort(
    (a, b) => b[1].estimatedCost - a[1].estimatedCost
  )[0];
  const verifiedPct =
    c.verifiedPrice && c.totalEstimatedCost > 0
      ? (c.verifiedPrice.verified / c.totalEstimatedCost) * 100
      : null;

  return (
    <Page
      title={t("costs:title")}
      subtitle={t("costs:subtitle", {
        start: new Date(c.periodStart).toLocaleDateString(locale),
        end: new Date(c.periodEnd).toLocaleDateString(locale),
      })}
    >
      {c.synthetic && <SyntheticBanner />}

      {c.source === "aggregate-collection" ? (
        <PhaseNotice>
          {t("costs:aggregateNotice.intro1")} <strong>USD</strong>{" "}
          {t("costs:aggregateNotice.intro2")} <code>fato_uso_ia</code>{" "}
          {t("costs:aggregateNotice.intro3")}
          {c.coverage && (
            <>
              {" "}
              {t("costs:aggregateNotice.coveragePrefix")} <strong>{c.coverage.startDate}</strong>{" "}
              {t("costs:aggregateNotice.coverageTo")} <strong>{c.coverage.endDate}</strong> (
              {t("costs:aggregateNotice.recordsCount", { count: c.coverage.records })})
              {t("costs:aggregateNotice.coverageSuffix")}
            </>
          )}
          {verifiedPct !== null && (
            <>
              {" "}
              <strong>{verifiedPct.toFixed(0)}%</strong> {t("costs:aggregateNotice.verifiedSuffix")}
            </>
          )}
          <br />
          <br />
          {t("costs:aggregateNotice.monitorDisclaimer")}
        </PhaseNotice>
      ) : (
        <PhaseNotice>
          {t("costs:estimateNotice.prefix")} <strong>{t("costs:estimateNotice.emphasis")}</strong>{" "}
          {t("costs:estimateNotice.middle")} (<code>pricing.ts</code>),{" "}
          {t("costs:estimateNotice.suffix")}
        </PhaseNotice>
      )}

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label={t("costs:stats.costLabel", { currency: c.currency })}
          value={money(c.totalEstimatedCost)}
        />
        <StatCard
          label={t("costs:stats.topProfileLabel")}
          value={topProfile ? profileLabel(topProfile[0]) : "—"}
          hint={topProfile ? money(topProfile[1].estimatedCost) : undefined}
        />
        <StatCard
          label={t("costs:stats.verifiedPriceLabel")}
          value={verifiedPct !== null ? `${verifiedPct.toFixed(0)}%` : "—"}
          hint={
            c.verifiedPrice
              ? t("costs:stats.unverifiedHint", { amount: money(c.verifiedPrice.unverified) })
              : undefined
          }
        />
        <StatCard
          label={t("costs:stats.totalTokensLabel")}
          value={Object.values(c.byProfile)
            .reduce((sum, p) => sum + p.tokens, 0)
            .toLocaleString(locale)}
        />
      </section>

      <Card title={t("costs:dailyCostTitle")}>
        {trend.data ? (
          <LineChart
            points={trend.data.costSeries}
            label={t("costs:dailyCostSeriesLabel")}
            formatValue={money}
          />
        ) : (
          <LoadingState />
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={t("costs:byProfileTitle")}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2">{t("costs:table.profile")}</th>
                <th className="pb-2">{t("costs:table.tokens")}</th>
                <th className="pb-2">{t("costs:table.estimatedCost")}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(c.byProfile).map(([profile, stats]) => (
                <tr key={profile} className="border-t border-border">
                  <td className="py-1.5">{profileLabel(profile)}</td>
                  <td className="py-1.5">{stats.tokens.toLocaleString(locale)}</td>
                  <td className="py-1.5">{money(stats.estimatedCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title={t("costs:byModelTitle")}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2">{t("costs:table.model")}</th>
                <th className="pb-2">{t("costs:table.tokens")}</th>
                <th className="pb-2">{t("costs:table.estimatedCost")}</th>
              </tr>
            </thead>
            <tbody>
              {c.byModel.map((m) => (
                <tr key={m.model} className="border-t border-border">
                  <td className="py-1.5">{m.model}</td>
                  <td className="py-1.5">{m.tokens.toLocaleString(locale)}</td>
                  <td className="py-1.5">{money(m.estimatedCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {c.byArea.length > 0 && (
        <Card title={t("costs:byAreaTitle")}>
          <p className="mb-3 text-xs text-muted-foreground">
            {t("costs:areaNote.prefix")} <code>fato_uso_ia</code>. <code>TBD</code>{" "}
            {t("costs:areaNote.middle")} <code>UNMAPPED</code> {t("costs:areaNote.suffix")}
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2">{t("costs:table.area")}</th>
                <th className="pb-2">{t("costs:table.tokens")}</th>
                <th className="pb-2">{t("costs:table.cost")}</th>
              </tr>
            </thead>
            <tbody>
              {c.byArea.map((a) => (
                <tr key={a.area} className="border-t border-border">
                  <td className="py-1.5">{a.area}</td>
                  <td className="py-1.5">{a.tokens.toLocaleString(locale)}</td>
                  <td className="py-1.5">{money(a.estimatedCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </Page>
  );
}
