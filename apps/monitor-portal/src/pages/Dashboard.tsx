import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import {
  Users,
  ArrowDownToLine,
  ArrowUpFromLine,
  Coins,
  DollarSign,
  FileText,
  MessageSquare,
  MessagesSquare,
  RadioTower,
} from "lucide-react";
import { profileLabel } from "@monitor-librechat/shared";
import { api, type Period } from "../lib/api.js";
import { usePolling } from "../lib/useAsync.js";
import { Page, Card, LoadingState, ErrorState } from "../components/Page.js";
import { StatCard } from "../components/StatCard.js";
import { SyntheticBanner } from "../components/SyntheticBanner.js";
import { SeverityBadge } from "../components/SeverityBadge.js";
import { Dialog } from "../components/Dialog.js";

const CHART_COLORS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

// A single 60s cadence for the whole dashboard. At small-team scale the resulting handful
// of queries per minute against the LibreChat database is negligible load. If volume grows,
// the natural candidate to slow down first is the role and resources block, which changes
// slowly. Polling is what gives the screen movement over time without needing a WebSocket.
const POLL_MS = 60_000;

const STATE_CFG = {
  normal: { color: "success", lamp: 2 },
  warning: { color: "warning", lamp: 1 },
  critical: { color: "destructive", lamp: 0 },
} as const;

const STATE_LABEL_KEY = {
  normal: "dashboard:conductStateNormal",
  warning: "dashboard:conductStateWarning",
  critical: "dashboard:conductStateCritical",
} as const;

function formatTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)} k`;
  return String(v);
}

/** Maps an i18next language tag to the Intl locale used for date/number formatting. */
function intlLocale(lng: string): string {
  return lng.startsWith("pt") ? "pt-BR" : "en-US";
}

function useElapsed(since: Date | null): string {
  const { t } = useTranslation();
  const [, forceRender] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceRender((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!since) return "—";
  const s = Math.max(0, Math.round((Date.now() - since.getTime()) / 1000));
  if (s < 60) return t("dashboard:elapsedSeconds", { s });
  return t("dashboard:elapsedMinutes", { m: Math.floor(s / 60) });
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.resolvedLanguage ?? "en");

  const AXES = [
    { k: "tokensPerActive", lbl: t("dashboard:axisTokensPerActive") },
    { k: "promptsPerActive", lbl: t("dashboard:axisPromptsPerActive") },
    { k: "conversationsPerActive", lbl: t("dashboard:axisConversationsPerActive") },
    { k: "avgActiveDays", lbl: t("dashboard:axisActiveDays") },
    { k: "distinctModels", lbl: t("dashboard:axisModels") },
    { k: "distinctAgents", lbl: t("dashboard:axisAgents") },
  ] as const;

  // Draft inputs are kept separate from the applied period: typing a date must not fire a
  // full refetch on every keystroke. The queries only rerun when the user applies.
  const [draft, setDraft] = useState({ from: daysAgoISO(30), to: todayISO() });
  const [period, setPeriod] = useState<Period>({});
  const periodKey = `${period.from ?? ""}|${period.to ?? ""}`;

  const adoption = usePolling(() => api.getAdoption(period), POLL_MS, [periodKey]);
  const usage = usePolling(() => api.getUsage(period), POLL_MS, [periodKey]);
  const cost = usePolling(() => api.getCost(period), POLL_MS, [periodKey]);
  const profileUsage = usePolling(() => api.getProfileUsage(period), POLL_MS, [periodKey]);
  const resources = usePolling(() => api.getResources(), POLL_MS);
  const adoptionTrend = usePolling(() => api.getAdoptionTrend(period), POLL_MS, [periodKey]);
  const costTrend = usePolling(() => api.getCostTrend(period), POLL_MS, [periodKey]);
  const userActivity = usePolling(() => api.getUserActivity(period), POLL_MS, [periodKey]);
  const security = usePolling(() => api.getSecurity(), POLL_MS);
  const conduct = usePolling(() => api.getConduct(period), POLL_MS, [periodKey]);

  const [openDialog, setOpenDialog] = useState<"users" | "conduct" | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  useEffect(() => {
    if (conduct.data) setLastUpdate(new Date());
  }, [conduct.data]);
  const elapsed = useElapsed(lastUpdate);

  const error = adoption.error ?? usage.error ?? cost.error ?? profileUsage.error ?? conduct.error;
  const loading =
    !adoption.data || !usage.data || !cost.data || !profileUsage.data || !conduct.data;

  /** X-axis label. With daily buckets the hour adds nothing and only costs width. */
  const formatBucketLabel = useCallback(
    (iso: string, bucketMinutes: number): string => {
      const d = new Date(iso);
      if (bucketMinutes >= 1440) {
        return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
      }
      return d
        .toLocaleString(locale, { day: "2-digit", month: "2-digit", hour: "2-digit" })
        .replace(",", "");
    },
    [locale]
  );

  const chartData = useMemo(() => {
    if (!conduct.data) return [];
    const window = 5;
    return conduct.data.series.map((b, i, arr) => {
      const since = Math.max(0, i - window + 1);
      const slice = arr.slice(since, i + 1);
      const mean = slice.reduce((s, x) => s + x.input + x.output, 0) / slice.length;
      return {
        hora: formatBucketLabel(b.timestamp, conduct.data!.bucketMinutes),
        input: b.input,
        output: b.output,
        mean: Math.round(mean),
      };
    });
  }, [conduct.data, formatBucketLabel]);

  const radarData = useMemo(() => {
    if (!profileUsage.data) return { rows: [], activeProfiles: [] as string[] };
    const active = profileUsage.data.profiles.filter((p) => p.active > 0);
    const max: Record<string, number> = {};
    for (const e of AXES) max[e.k] = Math.max(...active.map((p) => p[e.k]), 1);
    const rows = AXES.map((e) => {
      const row: Record<string, string | number> = { subject: e.lbl };
      for (const p of active) row[p.profile] = Number(((p[e.k] / max[e.k]) * 100).toFixed(1));
      return row;
    });
    return { rows, activeProfiles: active.map((p) => p.profile) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileUsage.data, i18n.resolvedLanguage]);

  // Compares the most recent half of the series against the earlier half, which works at any
  // bucket granularity the backend picked for the selected period.
  const tokenTrend = useMemo(() => {
    const s = conduct.data?.series ?? [];
    if (s.length < 4) return null;
    const totals = s.map((b) => b.input + b.output);
    const mid = Math.floor(totals.length / 2);
    const recent = totals.slice(mid).reduce((a, b) => a + b, 0);
    const previous = totals.slice(0, mid).reduce((a, b) => a + b, 0);
    if (previous === 0) return null;
    return ((recent - previous) / previous) * 100;
  }, [conduct.data]);

  if (error) return <ErrorState message={error} />;
  if (loading) return <LoadingState />;

  const a = adoption.data!;
  const u = usage.data!;
  const c = cost.data!;
  const cd = conduct.data!;
  const isSynthetic = a.synthetic || u.synthetic || c.synthetic || cd.synthetic;
  const money = (v: number) =>
    c.currency === "USD" ? `US$ ${v.toFixed(2)}` : `R$ ${v.toFixed(2)}`;
  const stateCfg = STATE_CFG[cd.state];

  // The bucket width comes from the backend, so the title describes what is actually on
  // screen instead of always claiming hourly.
  const bucketLabel =
    cd.bucketMinutes >= 1440
      ? t("dashboard:bucketPerDay")
      : cd.bucketMinutes > 60
        ? t("dashboard:bucketPerHours", { hours: cd.bucketMinutes / 60 })
        : t("dashboard:bucketPerHour");
  const chartTitle = t("dashboard:chartTitle", {
    bucket: bucketLabel,
    from: new Date(cd.series[0]?.timestamp ?? a.periodStart).toLocaleDateString(locale),
    to: new Date(a.periodEnd).toLocaleDateString(locale),
  });

  // Callouts are computed from the period's data on every render, never fixed text.
  const withoutUsage = profileUsage.data!.profiles.filter((p) => p.users > 0 && p.active === 0);
  const outsideAllowlist = resources.data
    ? profileUsage
        .data!.profiles.map((p) => {
          const cfg = resources.data!.profiles.find((r) => r.profile === p.profile);
          if (!cfg?.enforce || cfg.allowedModels.length === 0) return null;
          if (p.distinctModels <= cfg.allowedModels.length) return null;
          return { profile: p.profile, used: p.distinctModels, allowed: cfg.allowedModels.length };
        })
        .filter((x): x is { profile: string; used: number; allowed: number } => x !== null)
    : [];

  return (
    <Page
      title={t("dashboard:title")}
      subtitle={t("dashboard:periodLabel", {
        from: new Date(a.periodStart).toLocaleDateString(locale),
        to: new Date(a.periodEnd).toLocaleDateString(locale),
      })}
    >
      <div className="-mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RadioTower size={12} className="text-success" />
          {t("dashboard:updated", { elapsed })}
        </div>

        <form
          className="flex flex-wrap items-center gap-1.5 text-xs"
          onSubmit={(e) => {
            e.preventDefault();
            setPeriod({ from: draft.from, to: draft.to });
          }}
        >
          <label className="flex items-center gap-1">
            <span className="text-muted-foreground">{t("dashboard:periodFrom")}</span>
            <input
              type="date"
              value={draft.from}
              max={draft.to}
              onChange={(e) => setDraft((r) => ({ ...r, from: e.target.value }))}
              className="rounded border border-border bg-card px-1.5 py-0.5 text-xs text-foreground"
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-muted-foreground">{t("dashboard:periodTo")}</span>
            <input
              type="date"
              value={draft.to}
              min={draft.from}
              max={todayISO()}
              onChange={(e) => setDraft((r) => ({ ...r, to: e.target.value }))}
              className="rounded border border-border bg-card px-1.5 py-0.5 text-xs text-foreground"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            {t("dashboard:apply")}
          </button>
          {(period.from || period.to) && (
            <button
              type="button"
              onClick={() => {
                setPeriod({});
                setDraft({ from: daysAgoISO(30), to: todayISO() });
              }}
              className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            >
              {t("dashboard:last30Days")}
            </button>
          )}
          {[7, 15, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                const next = { from: daysAgoISO(d), to: todayISO() };
                setDraft(next);
                setPeriod(next);
              }}
              className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
            >
              {d}d
            </button>
          ))}
        </form>
      </div>

      {isSynthetic && <SyntheticBanner />}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label={t("dashboard:statUsers")}
          value={a.enabledUsers}
          hint={t("dashboard:statActiveHint", { count: a.mau })}
          icon={Users}
          trend={adoptionTrend.data?.dauSeries.map((p) => p.value)}
          onClick={() => setOpenDialog("users")}
        />
        <StatCard
          label={t("dashboard:statTokensInput")}
          value={formatTokens(u.inputTokens)}
          icon={ArrowDownToLine}
          trend={cd.series.map((b) => b.input)}
        />
        <StatCard
          label={t("dashboard:statTokensOutput")}
          value={formatTokens(u.outputTokens)}
          icon={ArrowUpFromLine}
          trend={cd.series.map((b) => b.output)}
        />
        <StatCard
          label={t("dashboard:statTokensTotal")}
          value={formatTokens(u.inputTokens + u.outputTokens)}
          icon={Coins}
          change={
            tokenTrend !== null
              ? `${tokenTrend >= 0 ? "+" : ""}${tokenTrend.toFixed(1)}%`
              : undefined
          }
          changeType={tokenTrend !== null ? (tokenTrend >= 0 ? "positive" : "negative") : "neutral"}
          hint={t("dashboard:vsPreviousHalf")}
          trend={cd.series.map((b) => b.input + b.output)}
        />
        <StatCard
          label={t("dashboard:statCost", { currency: c.currency })}
          value={money(c.totalEstimatedCost)}
          icon={DollarSign}
          trend={costTrend.data?.costSeries.map((p) => p.value)}
        />
        <StatCard
          label={t("dashboard:statFilesGenerated")}
          value={u.filesGenerated ?? "—"}
          icon={FileText}
        />
        <StatCard label={t("dashboard:statPrompts")} value={u.totalPrompts} icon={MessageSquare} />
        <StatCard
          label={t("dashboard:statConversations")}
          value={u.totalConversations}
          icon={MessagesSquare}
        />

        <div
          className="kpi-card col-span-2 flex cursor-pointer flex-col gap-1 hover:ring-1 hover:ring-primary/40 sm:col-span-1"
          role="button"
          tabIndex={0}
          onClick={() => setOpenDialog("conduct")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpenDialog("conduct");
            }
          }}
        >
          <p className="eyebrow">{t("dashboard:conduct")}</p>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex gap-1 rounded-md bg-muted p-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`h-3 w-3 rounded-full ${
                    i === stateCfg.lamp
                      ? stateCfg.color === "destructive"
                        ? "bg-destructive"
                        : stateCfg.color === "warning"
                          ? "bg-warning"
                          : "bg-success"
                      : "bg-border"
                  }`}
                />
              ))}
            </div>
            <span className="tnum text-sm font-semibold">
              {cd.zScore !== null
                ? `z = ${cd.zScore.toFixed(1).replace(".", locale === "pt-BR" ? "," : ".")}`
                : "—"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(STATE_LABEL_KEY[cd.state])}
            {cd.causes.length > 0
              ? ` · ${t("dashboard:causesCount", { count: cd.causes.length })}`
              : ""}
          </p>
        </div>
      </section>

      <Card title={chartTitle}>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="hora"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--border))" }}
              minTickGap={50}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={formatTokens}
            />
            <Tooltip
              formatter={(v, name) => [formatTokens(Number(v)), name]}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="input"
              name={t("dashboard:seriesInput")}
              stackId="tk"
              fill="hsl(var(--chart-1))"
              isAnimationActive={false}
            />
            <Bar
              dataKey="output"
              name={t("dashboard:seriesOutput")}
              stackId="tk"
              fill="hsl(var(--chart-2))"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            <Line
              dataKey="mean"
              name={t("dashboard:seriesMovingAverage")}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.1fr_1fr]">
        <Card title={t("dashboard:radarTitle")}>
          <ResponsiveContainer width="100%" height={330}>
            <RadarChart data={radarData.rows}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              {radarData.activeProfiles.map((profile, i) => (
                <Radar
                  key={profile}
                  name={profileLabel(profile)}
                  dataKey={profile}
                  stroke={`hsl(var(--${CHART_COLORS[i % CHART_COLORS.length]}))`}
                  fill={`hsl(var(--${CHART_COLORS[i % CHART_COLORS.length]}))`}
                  fillOpacity={0.18}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        <Card title={t("dashboard:tableTitle")}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2">{t("dashboard:colRole")}</th>
                  <th className="pb-2 text-right">{t("dashboard:colActive")}</th>
                  <th className="pb-2 text-right">{t("dashboard:colTokensPerActive")}</th>
                  <th className="pb-2 text-right">{t("dashboard:colPrompts")}</th>
                  <th className="pb-2 text-right">{t("dashboard:colModels")}</th>
                </tr>
              </thead>
              <tbody>
                {profileUsage.data!.profiles.map((p) => (
                  <tr key={p.profile} className="data-row border-t border-border">
                    <td className="py-1.5">{profileLabel(p.profile)}</td>
                    <td className="tnum py-1.5 text-right">
                      {p.active}/{p.users}
                    </td>
                    <td className="tnum py-1.5 text-right">{formatTokens(p.tokensPerActive)}</td>
                    <td className="tnum py-1.5 text-right">{p.promptsPerActive}</td>
                    <td className="tnum py-1.5 text-right">{p.distinctModels}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {withoutUsage.length > 0 && (
            <div className="status-warning mt-3 rounded-md p-3 text-xs">
              <strong>{withoutUsage.map((p) => profileLabel(p.profile)).join(", ")}</strong>{" "}
              {t("dashboard:didNotUseTool", { count: withoutUsage.length })}{" "}
              {t("dashboard:enabledZeroActive", {
                enabled: withoutUsage.reduce((s, p) => s + p.users, 0),
              })}
            </div>
          )}

          {outsideAllowlist.map((f) => (
            <div key={f.profile} className="status-warning mt-2 rounded-md p-3 text-xs">
              <strong>{profileLabel(f.profile)}</strong>{" "}
              {t("dashboard:outsideAllowlistPrefix", { used: f.used, allowed: f.allowed })}
              <Link to="/security" className="underline">
                {t("dashboard:seeSecurityLink")}
              </Link>
              .
            </div>
          ))}

          <Link to="/resources" className="mt-3 inline-block text-xs text-primary hover:underline">
            {t("dashboard:viewAuthorizedResources")}
          </Link>
        </Card>
      </div>

      {openDialog === "users" && (
        <Dialog
          title={t("dashboard:usersDialogTitle")}
          subtitle={t("dashboard:usersDialogSubtitle")}
          onClose={() => setOpenDialog(null)}
        >
          {!userActivity.data ? (
            <LoadingState />
          ) : userActivity.data.users.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dashboard:noUsersRegistered")}</p>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  <strong className="text-foreground">
                    {userActivity.data.users.filter((x) => x.active).length}
                  </strong>{" "}
                  {t("dashboard:activeWord")}
                </span>
                <span>
                  <strong className="text-foreground">
                    {userActivity.data.users.filter((x) => !x.active).length}
                  </strong>{" "}
                  {t("dashboard:inactiveWord")}
                </span>
                <span className="text-[11px]">{t("dashboard:activeDefinition")}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-2">{t("dashboard:colStatus")}</th>
                      <th className="pb-2">{t("dashboard:colUser")}</th>
                      <th className="pb-2">{t("dashboard:colProfile")}</th>
                      <th className="pb-2 text-right">{t("dashboard:colTokens")}</th>
                      <th className="pb-2 text-right">{t("dashboard:colPrompts")}</th>
                      <th className="pb-2">{t("dashboard:colLastAccess")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userActivity.data.users.map((us, i) => (
                      <tr key={`${us.name}-${i}`} className="data-row border-t border-border">
                        <td className="py-1.5">
                          <span
                            className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              us.active ? "status-active" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {us.active
                              ? t("dashboard:statusActive")
                              : t("dashboard:statusInactive")}
                          </span>
                        </td>
                        <td className="py-1.5">{us.name}</td>
                        <td className="py-1.5">{profileLabel(us.profile)}</td>
                        <td className="tnum py-1.5 text-right">{formatTokens(us.totalTokens)}</td>
                        <td className="tnum py-1.5 text-right">{us.prompts}</td>
                        <td className="py-1.5">
                          {us.lastAccess ? (
                            <>
                              {new Date(us.lastAccess).toLocaleString(locale)}
                              <span className="ml-1 text-[10px] text-muted-foreground">
                                {us.lastAccessSource === "usage"
                                  ? t("dashboard:accessSourceUsage")
                                  : t("dashboard:accessSourceLogin")}
                              </span>
                            </>
                          ) : (
                            t("dashboard:neverSignedIn")
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Dialog>
      )}

      {openDialog === "conduct" && (
        <Dialog
          title={t("dashboard:conductDialogTitle")}
          subtitle={t("dashboard:conductDialogSubtitle")}
          onClose={() => setOpenDialog(null)}
        >
          {!conduct.data ? (
            <LoadingState />
          ) : conduct.data.causes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dashboard:conductNoCauses")}</p>
          ) : (
            <div className="flex flex-col gap-4">
              {conduct.data.causes.map((cause, i) => (
                <div key={i} className="rounded-md border border-border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <SeverityBadge severity={cause.severity === "critical" ? "critical" : "high"} />
                    <p className="text-sm">{cause.summary}</p>
                  </div>

                  {cause.kind === "token-volume-anomaly" && cause.tokenAnomaly && (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t("dashboard:causeZScore")}
                        </dt>
                        <dd className="tnum font-semibold">{cause.tokenAnomaly.zScore}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t("dashboard:causeBucketTokens")}
                        </dt>
                        <dd className="tnum font-semibold">
                          {formatTokens(cause.tokenAnomaly.bucketTokens)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t("dashboard:causeExpectedMean")}
                        </dt>
                        <dd className="tnum font-semibold">
                          {formatTokens(cause.tokenAnomaly.meanTokens)} ±{" "}
                          {formatTokens(cause.tokenAnomaly.stdDevTokens)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t("dashboard:causeWindow")}
                        </dt>
                        <dd className="font-semibold">
                          {t("dashboard:causeWindowValue", {
                            count: cause.tokenAnomaly.windowBuckets,
                          })}
                        </dd>
                      </div>
                      <div className="col-span-2 sm:col-span-4">
                        <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t("dashboard:causeBucketTime")}
                        </dt>
                        <dd className="font-semibold">
                          {new Date(cause.tokenAnomaly.bucketTimestamp).toLocaleString(locale)}
                        </dd>
                      </div>
                    </dl>
                  )}

                  {cause.kind === "security-detection" && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="pb-2">{t("dashboard:colDate")}</th>
                            <th className="pb-2">{t("dashboard:colUser")}</th>
                            <th className="pb-2">{t("dashboard:colSeverity")}</th>
                            <th className="pb-2">{t("dashboard:colPolicy")}</th>
                            <th className="pb-2">{t("dashboard:colEvidence")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(security.data?.alerts ?? [])
                            .filter((al) => al.severity === "critical" || al.severity === "high")
                            .map((al, j) => (
                              <tr
                                key={`${al.policyId}-${j}`}
                                className="data-row border-t border-border"
                              >
                                <td className="whitespace-nowrap py-1.5">
                                  {new Date(al.timestamp).toLocaleString(locale)}
                                </td>
                                <td className="py-1.5 font-mono">{al.subjectRef}</td>
                                <td className="py-1.5">
                                  <SeverityBadge severity={al.severity} />
                                </td>
                                <td className="py-1.5">
                                  <span className="font-mono text-[10px]">{al.policyId}</span>{" "}
                                  {al.policyName}
                                </td>
                                <td className="py-1.5 font-mono text-[11px]">
                                  {al.evidenceMasked}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <Link to="/security" className="mt-3 inline-block text-xs text-primary hover:underline">
            {t("dashboard:viewAllInSecurity")}
          </Link>
        </Dialog>
      )}
    </Page>
  );
}
