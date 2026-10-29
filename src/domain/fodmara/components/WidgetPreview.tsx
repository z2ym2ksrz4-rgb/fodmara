import { useTranslation } from "react-i18next";
import { GutMark } from "./GutMark";

/** The little mock of the home-screen widget, shared by the onboarding intro and the settings guide. */
export function WidgetPreview() {
  const { t } = useTranslation();
  return (
    <div className="widget-preview">
      <div className="wp-tile"><GutMark size={40} color="#FFFFFF" core="#FFE3C7" /><span>{t("widget.actingUp")}</span></div>
      <div className="wp-text"><strong>{t("widget.previewLine1")}</strong><span className="muted small">{t("widget.previewLine2")}</span></div>
    </div>
  );
}
