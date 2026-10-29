import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, localDay } from "@/core/ui";
import { monthRange, patterns, tagFrequency, listCheckins, listEpisodes, checkinContrast, checkinTrend } from "@/core/diary";
import { listMeals, listStools, bristolSummary, mealPatterns, listChallenges, challengeStats } from "../data";
import { learningSentences } from "../learning";
import { useSettings } from "@/core/settings";
import { maybeAskForReview } from "@/core/review";
import appConfig from "../../../../app.config.json";
import { contrastFields } from "../config";
import type { WeekRow, ChallengeRow } from "../report";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Monday-based weeks covering [from, to), each with the averages of the check-in fields, flare-ups and toilet visits. */
async function weekRows(fromIso: string, toIso: string): Promise<WeekRow[]> {
  const from = new Date(fromIso); const to = new Date(toIso);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate() - ((from.getDay() + 6) % 7));
  const checkins = await listCheckins(localDay(start), localDay(new Date(to.getTime() - 1)));
  const eps = await listEpisodes(start.toISOString(), toIso);
  const stools = await listStools(start.toISOString(), toIso);
  const out: WeekRow[] = [];
  for (let w = new Date(start); w < to; w.setDate(w.getDate() + 7)) {
    const a = localDay(w); const e = new Date(w); e.setDate(e.getDate() + 7); const b = localDay(e);
    const days = checkins.filter((c) => c.date >= a && c.date < b).map((c) => { try { return JSON.parse(c.extra ?? "{}") as Record<string, number>; } catch { return {}; } });
    const col = (k: string) => avg(days.map((d) => d[k]).filter((v): v is number => typeof v === "number"));
    const inWeek = (iso: string) => iso >= w.toISOString() && iso < e.toISOString();
    out.push({ from: new Date(w).toISOString(), gut: col("gut"), bloating: col("bloating"), pain: col("pain"), sleep: col("sleep"), stress: col("stress"), days: days.filter((d) => typeof d.gut === "number").length, flares: eps.filter((x) => inWeek(x.startedAt)).length, stools: stools.filter((x) => inWeek(x.at)).length });
  }
  return out;
}

export function ReportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const [preset, setPreset] = useState<"month" | "last" | "3m" | "custom">("3m");
  const [from, setFrom] = useState(() => localDay(new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1)));
  const [to, setTo] = useState(() => localDay());
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");

  const range = () => {
    const now = new Date();
    if (preset === "month") return monthRange(now);
    if (preset === "last") return monthRange(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    if (preset === "3m") return { fromIso: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString(), toIso: monthRange(now).toIso };
    return { fromIso: new Date(from + "T00:00:00").toISOString(), toIso: new Date(new Date(to + "T00:00:00").getTime() + 864e5).toISOString() };
  };
  const profileLine = () => {
    if (!settings.conditionProfile) return null;
    try {
      const p = JSON.parse(settings.conditionProfile) as { since?: string; type?: string; diagnosed?: string };
      const parts: string[] = [];
      if (p.type) parts.push(`${t("onboarding.typeQShort")}: ${t(`onboarding.type.${p.type}`)}`);
      if (p.since) parts.push(`${t("onboarding.sinceQShort")}: ${t(`onboarding.since.${p.since}`)}`);
      if (p.diagnosed) parts.push(`${t("onboarding.diagnosedQShort")}: ${t(`onboarding.diagnosed.${p.diagnosed}`)}`);
      if (settings.fodmapPhase) parts.push(`${t("phase.label")}: ${t(`phase.${settings.fodmapPhase}`)}`);
      return parts.join(" · ") || null;
    } catch { return null; }
  };
  const make = async () => {
    setBusy(true);
    try {
      const { buildReport, sharePdf } = await import("../report");
      const { fromIso, toIso } = range();
      const weeks = await weekRows(fromIso, toIso);
      const cs = await listCheckins(fromIso.slice(0, 10), localDay(new Date(new Date(toIso).getTime() - 1)));
      const days = cs.map((c) => { try { return (JSON.parse(c.extra ?? "{}") as Record<string, number>); } catch { return {}; } });
      const gv = days.map((x) => x.gut).filter((v): v is number => typeof v === "number");
      const day = { gut: avg(gv), bloating: avg(days.map((x) => x.bloating).filter((v): v is number => typeof v === "number")), logged: gv.length, hard: gv.filter((v) => v >= 7).length };
      const freq = await tagFrequency(fromIso, toIso);
      const mp = await mealPatterns();
      const learning = learningSentences({ trend30: await checkinTrend("gut", 30), contrasts: await checkinContrast("gut", contrastFields), pat: await patterns(), freq, meals: mp }, t, i18n.language);
      const challenges: ChallengeRow[] = [];
      for (const c of (await listChallenges()).filter((x) => x.status !== "active").reverse()) {
        const st = await challengeStats(c);
        challenges.push({ group: t(`fodmap.group.${c.groupKey}`), food: c.foodKey ? t(`food.items.${c.foodKey}`) : c.foodName ?? "", start: c.startDate, result: t(`test.resultShort.${c.result ?? "reaction"}`), before: st.before, test: st.test, flares: st.flares, note: c.note ?? "" });
      }
      const mealRows = [...mp.groups, ...mp.foods.slice(0, 6)].map((m) => ({ name: m.kind === "group" ? t(`fodmap.group.${m.key}`) : m.foodKey ? t(`food.items.${m.foodKey}`) : m.customName ?? "", withN: m.withN, withShare: m.withShare, otherShare: m.otherShare }));
      const doc = await buildReport(fromIso, toIso, t, i18n.language, {
        name: settings.userName, profile: profileLine(), notes, weeks, day, learning,
        meals: (await listMeals(fromIso, toIso)).length, stools: await bristolSummary(fromIso, toIso), challenges, mealRows,
      });
      await sharePdf(doc, `${appConfig.appSlug}-${fromIso.slice(0, 10)}-${toIso.slice(0, 10)}.pdf`, t("report.title"));
      await settings.set("successEvents", settings.successEvents + 1); void maybeAskForReview();
      onClose();
    } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={t("report.title")}>
      <p className="muted small">{t("report.sub")}</p>
      <div className="stack" style={{ margin: "10px 0" }}>
        {(["month", "last", "3m", "custom"] as const).map((p) => (
          <button key={p} className={`chip ${preset === p ? "on" : ""}`} style={{ textAlign: "left" }} onClick={() => setPreset(p)}>{t(`report.preset.${p}`)}</button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="row">
          <label className="field"><span>{t("report.from")}</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field"><span>{t("report.to")}</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      )}
      <label className="field"><span>{t("report.notesTitle")}</span>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("report.notesPh")} />
      </label>
      <button className="cta" onClick={make} disabled={busy}>{busy ? "…" : t("report.make")}</button>
      <p className="disclaimer">{t("report.footer", { app: appConfig.appName })}</p>
    </Sheet>
  );
}
