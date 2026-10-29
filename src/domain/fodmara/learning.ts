import type { TFunction } from "i18next";
import type { Contrast, Patterns } from "@/core/diary";
import type { MealPattern } from "./data";

type Freq = { groupKey: string; labelKey: string | null; label: string | null; n: number; total: number }[];

/**
 * "What it looks like" in plain sentences. Phrased as observations about the user's own log ("after meals with…
 * a flare-up followed in…"), never as a cause, a diagnosis or advice. Shown on Insights and in the PDF.
 */
export function learningSentences(d: { trend30: { now: number | null; before: number | null; nNow: number }; contrasts: Contrast[]; pat: Patterns | null; freq: Freq; meals?: { groups: MealPattern[]; foods: MealPattern[] } | null }, t: TFunction, lang: string): string[] {
  const out: string[] = [];
  const fmt = (n: number) => n.toLocaleString(lang, { maximumFractionDigits: 1 });
  const pct = (x: number) => Math.round(x * 100);
  const { trend30, contrasts, pat, freq, meals } = d;
  if (trend30.now != null && trend30.before != null && trend30.nNow >= 10) {
    const diff = trend30.now - trend30.before;
    out.push(t(Math.abs(diff) < 0.4 ? "learn.trendSame" : diff < 0 ? "learn.trendDown" : "learn.trendUp", { now: fmt(trend30.now), before: fmt(trend30.before) }));
  }
  for (const c of contrasts) {
    if (Math.abs(c.hi - c.lo) < 0.7) continue;
    out.push(t(`learn.contrast.${c.key}`, { hi: fmt(c.hi), lo: fmt(c.lo) }));
  }
  const strong = [...(meals?.groups ?? []), ...(meals?.foods ?? [])].filter((m) => m.withN >= 6 && m.withShare - m.otherShare >= 0.15).sort((a, b) => (b.withShare - b.otherShare) - (a.withShare - a.otherShare))[0];
  if (strong) {
    const name = strong.kind === "group" ? t(`fodmap.group.${strong.key}`) : strong.foodKey ? t(`food.items.${strong.foodKey}`) : strong.customName ?? "";
    out.push(t("learn.meal", { name, pct: pct(strong.withShare), other: pct(strong.otherShare) }));
  }
  if (pat?.weekday) out.push(t("learn.weekday", { day: new Date(2024, 0, 7 + pat.weekday.day).toLocaleDateString(lang, { weekday: "long" }), pct: pct(pat.weekday.share) }));
  if (pat?.timeOfDay) out.push(t("learn.time", { part: t(`insights.part.${pat.timeOfDay.part}`), pct: pct(pat.timeOfDay.share) }));
  if (pat?.period && pat.period.share >= 0.25) out.push(t("learn.period", { pct: pct(pat.period.share) }));
  const top = (g: string) => freq.filter((f) => f.groupKey === g && f.total >= 4).sort((a, b) => b.n - a.n)[0];
  const tr = top("trigger"); if (tr && tr.n / tr.total >= 0.3) out.push(t("learn.trigger", { tag: tr.labelKey ? t(tr.labelKey) : tr.label ?? "", pct: pct(tr.n / tr.total) }));
  const re = top("relief"); if (re && re.n / re.total >= 0.3) out.push(t("learn.relief", { tag: re.labelKey ? t(re.labelKey) : re.label ?? "", pct: pct(re.n / re.total) }));
  return out;
}
