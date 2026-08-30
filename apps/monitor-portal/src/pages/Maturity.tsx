import { useTranslation } from "react-i18next";
import { Page, Card } from "../components/Page.js";
import { PhaseNotice } from "../components/PhaseNotice.js";

const DIMENSIONS = [
  { id: "usage", weight: "15%", available: true },
  { id: "promptQuality", weight: "25%", available: false },
  { id: "agents", weight: "15%", available: true },
  { id: "tools", weight: "10%", available: true },
  { id: "reuse", weight: "15%", available: false },
  { id: "contribution", weight: "10%", available: false },
  { id: "security", weight: "10%", available: true },
];

const LEVELS = [
  { code: "N0", id: "n0" },
  { code: "N1", id: "n1" },
  { code: "N2", id: "n2" },
  { code: "N3", id: "n3" },
  { code: "N4", id: "n4" },
  { code: "N5", id: "n5" },
];

export function Maturity() {
  const { t } = useTranslation();

  return (
    <Page title={t("common:nav.maturity")} subtitle={t("maturity:subtitle")}>
      <PhaseNotice>
        {t("maturity:notice.prefix")}
        <strong>{t("maturity:notice.strong")}</strong>
        {t("maturity:notice.rest")}
        <br />
        <br />
        {t("maturity:notice.available")}
      </PhaseNotice>

      <Card title={t("maturity:dimensionsCard.title")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-2">{t("maturity:dimensionsCard.columns.dimension")}</th>
              <th className="pb-2">{t("maturity:dimensionsCard.columns.weight")}</th>
              <th className="pb-2">{t("maturity:dimensionsCard.columns.evidence")}</th>
              <th className="pb-2">{t("maturity:dimensionsCard.columns.dataAvailableToday")}</th>
            </tr>
          </thead>
          <tbody>
            {DIMENSIONS.map((d) => (
              <tr key={d.id} className="border-t border-border align-top">
                <td className="py-1.5">{t(`maturity:dimensions.${d.id}.name`)}</td>
                <td className="py-1.5">{d.weight}</td>
                <td className="py-1.5 text-xs text-muted-foreground">
                  {t(`maturity:dimensions.${d.id}.evidence`)}
                </td>
                <td className="py-1.5">
                  {d.available ? (
                    <span className="text-success">
                      {t("maturity:dimensionsCard.availableYes")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t("maturity:dimensionsCard.availableNo")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title={t("maturity:levelsCard.title")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-2">{t("maturity:levelsCard.columns.level")}</th>
              <th className="pb-2">{t("maturity:levelsCard.columns.name")}</th>
              <th className="pb-2">{t("maturity:levelsCard.columns.description")}</th>
            </tr>
          </thead>
          <tbody>
            {LEVELS.map((n) => (
              <tr key={n.code} className="border-t border-border">
                <td className="py-1.5 font-mono text-xs">{n.code}</td>
                <td className="py-1.5">{t(`maturity:levels.${n.id}.name`)}</td>
                <td className="py-1.5 text-xs text-muted-foreground">
                  {t(`maturity:levels.${n.id}.description`)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Page>
  );
}
