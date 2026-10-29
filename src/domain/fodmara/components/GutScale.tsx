import { useTranslation } from "react-i18next";
import { haptics } from "@/core/ui";

/**
 * The day's gut symptoms, 0–10. Eleven tappable cells on a calm-to-warm ramp, the chosen value shown big with a word.
 * 0 = no symptoms, 10 = as bad as it gets. Words come from gutScale.level.<bucket>.
 */
export const gutWord = (v: number) => (v === 0 ? "none" : v <= 3 ? "mild" : v <= 6 ? "moderate" : v <= 8 ? "bad" : "veryBad");

export function GutScale({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const { t } = useTranslation();
  return (
    <div className="loud">
      <div className="loud-head">
        <span className="loud-n">{value ?? "–"}</span>
        <span className="loud-w">{value == null ? t("gutScale.pick") : t(`gutScale.level.${gutWord(value)}`)}</span>
      </div>
      <div className="loud-scale" role="radiogroup" aria-label={t("gutScale.question")}>
        {Array.from({ length: 11 }, (_, v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} className={`l${v} ${value === v ? "on" : ""}`}
            onClick={() => { haptics.tap(); onChange(v); }}>{v}</button>
        ))}
      </div>
      <div className="row between small muted"><span>{t("gutScale.min")}</span><span>{t("gutScale.max")}</span></div>
    </div>
  );
}
