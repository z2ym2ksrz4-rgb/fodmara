import { useTranslation } from "react-i18next";
import { Capacitor } from "@capacitor/core";
import { Sheet } from "@/core/ui";
import { useUi } from "../store";
import { WidgetPreview } from "../components/WidgetPreview";
import { GROUPS } from "../fodmap";

/** Explainers opened from several places: when to see a doctor, the 0–10 gut scale, Bristol types, FODMAP basics, the widget. */
export function InfoSheets() {
  const { t } = useTranslation();
  const which = useUi((s) => s.infoSheet);
  const openInfo = useUi((s) => s.openInfo);
  const close = () => openInfo(null);
  const ios = Capacitor.getPlatform() !== "android";
  const list = (k: string) => (t(k, { returnObjects: true }) as string[]).map((x, i) => <li key={i}>{x}</li>);

  return (
    <>
      <Sheet open={which === "redFlags"} onClose={close} title={t("redFlags.title")}>
        <p>{t("redFlags.intro")}</p>
        <div className="card bad col"><strong>{t("redFlags.urgentTitle")}</strong><ul className="plain">{list("redFlags.urgent")}</ul></div>
        <div className="card warn col"><strong>{t("redFlags.soonTitle")}</strong><ul className="plain">{list("redFlags.soon")}</ul></div>
        <p className="muted small">{t("redFlags.routine")}</p>
        <p className="disclaimer">{t("redFlags.disclaimer")}</p>
        <button className="cta" onClick={close}>{t("common.done")}</button>
      </Sheet>

      <Sheet open={which === "gut"} onClose={close} title={t("gutScale.infoTitle")}>
        <p>{t("gutScale.infoWhat")}</p>
        <ul className="plain">{list("gutScale.infoScale")}</ul>
        <p className="muted small">{t("gutScale.infoTip")}</p>
        <button className="cta" onClick={close}>{t("common.done")}</button>
      </Sheet>

      <Sheet open={which === "bristol"} onClose={close} title={t("stool.infoTitle")}>
        <p>{t("stool.infoWhat")}</p>
        <ul className="plain">{[1, 2, 3, 4, 5, 6, 7].map((n) => <li key={n}><strong>{n}</strong> – {t(`stool.typeLong.${n}`)}</li>)}</ul>
        <p className="muted small">{t("stool.infoTip")}</p>
        <button className="cta" onClick={close}>{t("common.done")}</button>
      </Sheet>

      <Sheet open={which === "fodmap"} onClose={close} title={t("fodmap.infoTitle")}>
        <p>{t("fodmap.infoWhat")}</p>
        <ul className="plain">{GROUPS.map((g) => <li key={g}><strong>{t(`fodmap.group.${g}`)}</strong> – {t(`fodmap.groupHint.${g}`)}</li>)}</ul>
        <h3>{t("fodmap.phasesTitle")}</h3>
        <ol className="steps">{list("fodmap.phases")}</ol>
        <p className="muted small">{t("fodmap.infoTip")}</p>
        <p className="disclaimer">{t("fodmap.infoDisclaimer")}</p>
        <button className="cta" onClick={close}>{t("common.done")}</button>
      </Sheet>

      <Sheet open={which === "widget"} onClose={close} title={t("widget.title")}>
        <WidgetPreview />
        <p className="muted">{t("widget.intro")}</p>
        <ol className="steps">{list(ios ? "widget.stepsIos" : "widget.stepsAndroid")}</ol>
        {ios && <p className="muted small">{t("widget.lockscreen")}</p>}
        <button className="cta" onClick={close}>{t("common.done")}</button>
      </Sheet>
    </>
  );
}
