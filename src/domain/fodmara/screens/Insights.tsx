import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  episodeSummary, tagFrequency, monthRange, patterns as loadPatterns, checkinSeries, checkinMonthly, checkinContrast, checkinTrend,
  type Patterns, type Contrast,
} from "@/core/diary";
import { localDay } from "@/core/ui";
import { useProGate } from "@/core/purchases";
import { useUi } from "../store";
import { ReportSheet } from "./Report";
import { learningSentences } from "../learning";
import { Spark } from "../components/Spark";
import { contrastFields } from "../config";
import { BristolBars } from "../components/Bristol";
import { mealPatterns, bristolSummary, type MealPattern } from "../data";

const avgOf = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Descriptive statistics only: averages, counts and shares of what the user logged. No scoring, no classification, no advice. */
export function Insights() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const gate = useProGate();
  const version = useUi((s) => s.version);
  const openInfo = useUi((s) => s.openInfo);
  const [range, setRange] = useState<"month" | "3m" | "12m">("3m");
  const [reportOpen, setReportOpen] = useState(false);
  const [daily, setDaily] = useState<{ date: string; v: number }[]>([]);
  const [monthly, setMonthly] = useState<{ month: string; avg: number | null; n: number }[]>([]);
  const [sum, setSum] = useState<Awaited<ReturnType<typeof episodeSummary>> | null>(null);
  const [day, setDay] = useState<{ gut: number | null; bloating: number | null; logged: number; hard: number }>({ gut: null, bloating: null, logged: 0, hard: 0 });
  const [meals, setMeals] = useState<{ groups: MealPattern[]; foods: MealPattern[]; meals: number } | null>(null);
  const [bristol, setBristol] = useState<Awaited<ReturnType<typeof bristolSummary>> | null>(null);
  const [freq, setFreq] = useState<Awaited<ReturnType<typeof tagFrequency>>>([]);
  const [pat, setPat] = useState<Patterns | null>(null);
  const [contrasts, setContrasts] = useState<Contrast[]>([]);
  const [trend30, setTrend30] = useState<{ now: number | null; before: number | null; nNow: number }>({ now: null, before: null, nNow: 0 });

  const load = useCallback(async () => {
    if (!gate.isPro) return;
    const now = new Date();
    const months = range === "month" ? 1 : range === "3m" ? 3 : 12;
    const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const fromIso = from.toISOString(), toIso = monthRange(now).toIso;
    const d90 = new Date(); d90.setDate(d90.getDate() - 89);
    setDaily(await checkinSeries("gut", localDay(d90), localDay()));
    setMonthly(await checkinMonthly("gut", 12));
    setSum(await episodeSummary(fromIso, toIso));
    const gut = await checkinSeries("gut", localDay(from), localDay());
    const bl = await checkinSeries("bloating", localDay(from), localDay());
    setDay({ gut: avgOf(gut.map((x) => x.v)), bloating: avgOf(bl.map((x) => x.v)), logged: gut.length, hard: gut.filter((x) => x.v >= 7).length });
    setMeals(await mealPatterns()); setBristol(await bristolSummary(fromIso, toIso));
    setFreq(await tagFrequency(fromIso, toIso));
    setPat(await loadPatterns());
    setContrasts(await checkinContrast("gut", contrastFields));
    setTrend30(await checkinTrend("gut", 30));
  }, [gate.isPro, range]);
  useEffect(() => { void load(); }, [load, version]);

  if (!gate.isPro) {
    return (
      <section className="screen">
        <h1>{t("insights.title")}</h1>
        <div className="card col">
          <strong>{t("insights.lockedTitle")}</strong>
          <p className="muted">{t("insights.lockedBody")}</p>
          <button onClick={() => gate.allow("insights")}>{t("plan.upgrade")}</button>
        </div>
      </section>
    );
  }

  const f1 = (n: number | null) => (n == null ? "–" : n.toLocaleString(lang, { maximumFractionDigits: 1 }));
  const Freq = ({ group }: { group: string }) => {
    const rows = freq.filter((f) => f.groupKey === group).slice(0, 5);
    if (!rows.length) return <p className="muted small">{t("insights.noData")}</p>;
    return (
      <div className="freq">
        {rows.map((f) => {
          const pct = f.total ? Math.round((f.n / f.total) * 100) : 0;
          return (
            <div className="f" key={f.tagId}>
              <span>{f.labelKey ? t(f.labelKey) : f.label}</span><span className="muted">{pct}%</span>
              <div className="track"><div className="fill" style={{ width: `${pct}%` }} /></div>
            </div>
          );
        })}
      </div>
    );
  };
  const lines = learningSentences({ trend30, contrasts, pat, freq, meals }, t, lang);
  const shown = contrasts.filter((c) => Math.abs(c.hi - c.lo) >= 0.7);

  return (
    <section className="screen">
      <h1>{t("insights.title")}</h1>
      <button className="cta report-btn" style={{ marginTop: 4 }} onClick={() => setReportOpen(true)}>📄 {t("report.cta")}</button>

      <h2>{t("insights.gut90")}</h2>
      {daily.length >= 2 ? <div className="card spark-card"><Spark data={daily} days={90} height={140} lang={lang} /></div> : <p className="muted small">{t("insights.noData")}</p>}
      <p className="muted small">{t("insights.gut90Hint")}</p>

      <h2>{t("insights.monthly")}</h2>
      <div className="bars">
        {monthly.map((m, i) => <div key={m.month} className={`bar ${i === monthly.length - 1 ? "cur" : ""} ${m.avg == null ? "none" : ""}`} style={{ height: `${((m.avg ?? 0) / 10) * 100}%` }} title={`${m.month}: ${f1(m.avg)}`} />)}
      </div>
      <div className="barlbl">{monthly.map((m) => <span key={m.month}>{new Date(m.month + "-01T12:00:00").toLocaleDateString(lang, { month: "narrow" })}</span>)}</div>

      <div className="segment" style={{ margin: "16px 0 8px" }}>
        {(["month", "3m", "12m"] as const).map((r) => <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>{t(`insights.range.${r}`)}</button>)}
      </div>
      <div className="stats">
        <div className="stat"><div className="n">{f1(day.gut)}</div><div className="l">{t("insights.avgGut")}</div></div>
        <div className="stat"><div className="n">{f1(day.bloating)}</div><div className="l">{t("insights.avgBloating")}</div></div>
        <div className="stat"><div className="n">{day.hard}</div><div className="l">{t("insights.hardDays", { n: day.logged })}</div></div>
        <div className="stat"><div className="n">{sum?.episodes ?? 0}</div><div className="l">{t("insights.flares")}</div></div>
        {sum?.avgHours != null && <div className="stat" style={{ gridColumn: "1 / -1" }}><div className="n">{f1(sum.avgHours)}</div><div className="l">{t("insights.avgFlareHours")}</div></div>}
      </div>

      <h2>{t("insights.learnTitle")}</h2>
      {lines.length
        ? <div className="card col learn">{lines.map((l, i) => <p key={i}>{l}</p>)}<span className="muted small">{t("insights.learnNote")}</span></div>
        : <p className="muted small">{t("insights.learnEmpty")}</p>}

      <h2>{t("insights.patterns")}</h2>
      {shown.length || pat?.weekday || pat?.timeOfDay || pat?.period ? (
        <div className="stack">
          {shown.map((c) => (
            <div className="card col" key={c.key}>
              <strong>{t(`insights.contrast.${c.key}`, { hi: f1(c.hi), lo: f1(c.lo) })}</strong>
              <span className="muted small">{t("insights.contrastBasis", { hi: c.nHi, lo: c.nLo })}</span>
            </div>
          ))}
          {pat?.weekday && <div className="card col"><strong>{t("insights.patWeekday", { day: new Date(2024, 0, 7 + pat.weekday.day).toLocaleDateString(lang, { weekday: "long" }), pct: Math.round(pat.weekday.share * 100) })}</strong><span className="muted small">{t("insights.patBasis", { n: pat.attacks })}</span></div>}
          {pat?.timeOfDay && <div className="card col"><strong>{t("insights.patTime", { part: t(`insights.part.${pat.timeOfDay.part}`), pct: Math.round(pat.timeOfDay.share * 100) })}</strong><span className="muted small">{t("insights.patBasis", { n: pat.attacks })}</span></div>}
          {pat?.period && <div className="card col"><strong>{t("insights.patPeriod", { pct: Math.round(pat.period.share * 100) })}</strong><span className="muted small">{t("insights.patBasis", { n: pat.attacks })}</span></div>}
          <p className="muted small">{t("insights.patNote")}</p>
        </div>
      ) : <p className="muted small">{t("insights.patNeed")}</p>}

      <h2>{t("insights.mealsTitle")}</h2>
      {meals && (meals.groups.length || meals.foods.length) ? (
        <div className="stack">
          {[...meals.groups, ...meals.foods.slice(0, 5)].map((m) => {
            const name = m.kind === "group" ? t(`fodmap.group.${m.key}`) : m.foodKey ? t(`food.items.${m.foodKey}`) : m.customName ?? "";
            const hi = m.withShare - m.otherShare >= 0.15;
            return (
              <div className={`card col meal-pat ${hi ? "hi" : ""}`} key={m.key}>
                <strong>{t("insights.mealPat", { name, pct: Math.round(m.withShare * 100), other: Math.round(m.otherShare * 100) })}</strong>
                <div className="pair"><i style={{ width: `${Math.round(m.withShare * 100)}%` }} /><i className="o" style={{ width: `${Math.round(m.otherShare * 100)}%` }} /></div>
                <span className="muted small">{t("insights.mealPatBasis", { n: m.withN, o: m.otherN })}</span>
              </div>
            );
          })}
          <p className="muted small">{t("insights.mealPatNote")}</p>
        </div>
      ) : <p className="muted small">{t("insights.mealPatNeed", { n: meals?.meals ?? 0 })}</p>}

      <h2>{t("insights.bristolTitle")} <button type="button" className="linklike small" onClick={() => openInfo("bristol")}>ⓘ</button></h2>
      {bristol && bristol.typed > 0 ? (
        <>
          <BristolBars types={bristol.types} />
          <div className="barlbl">{[1, 2, 3, 4, 5, 6, 7].map((n) => <span key={n}>{n}</span>)}</div>
          <p className="muted small">{t("insights.bristolSummary", { n: bristol.total, mid: bristol.types[2] + bristol.types[3], hard: bristol.types[0] + bristol.types[1], loose: bristol.types[4] + bristol.types[5] + bristol.types[6], urg: bristol.urgency })}</p>
        </>
      ) : <p className="muted small">{t("insights.noData")}</p>}

      <h2>{t("diary.groups.symptom")} <span className="muted" style={{ textTransform: "none", letterSpacing: 0 }}>· {t("insights.shareOfFlares")}</span></h2>
      <Freq group="symptom" />
      <h2>{t("diary.groups.trigger")}</h2>
      <Freq group="trigger" />
      <h2>{t("diary.groups.relief")}</h2>
      <Freq group="relief" />
      <p className="disclaimer">{t("insights.disclaimer")}</p>
      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} />
    </section>
  );
}
