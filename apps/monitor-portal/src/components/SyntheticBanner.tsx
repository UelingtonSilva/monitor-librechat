import { FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";

export function SyntheticBanner() {
  const { t } = useTranslation();
  return (
    <div className="status-warning flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm">
      <FlaskConical size={15} className="shrink-0" />
      {t("common:syntheticBanner")}
    </div>
  );
}
