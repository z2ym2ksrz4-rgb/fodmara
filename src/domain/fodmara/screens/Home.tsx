import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  openEpisode, startEpisode, listEpisodes, monthRange, getCheckin, setCheckin, checkinSeries, checkinTrend,
  type Episode, type DailyCheckin,
} from "@/core/diary";
import { haptics, fmtTime, localDay, hours } from "@/core/ui";
import { useSettings } from "@/core/settings";
import { usePurchases } from "@/core/purchases";
import { useUi } from "../store";
import { GutMark } from "../components/GutMark";
import { GutScale, gutWord } from "../components/GutScale";
import { Spark } from "../components/Spark";
import { PlateIcon, RollIcon } from "../components/Icons";
import { publishWidget } from "../widget";
import { applyOnboardingWishes } from "../wishes";
import { sideFields, statusFor } from "../config";
import { TEST_DAYS, WASHOUT_DAYS } from "../fodmap";
import {
  createMeal, createStool, listMeals, listStools, activeChallenge, challengeDay, doneDaysOf, setDoneDay, eliminationProgress,
  type MealWithItems, type Stool, type Challenge,
} from "../data";
import { foodName } from "./MealSheet";

type Extra = Record<string, number | boolean>;
type Item = { at: string; kind: "meal" | "stool" | "flare"; id: string; title: string; sub: string };

/**
 * Home: where you are in the low-FODMAP plan, today's gut number, then three ways to log (flare-up, meal, toilet),
 * today's timeline and the 7-day picture.
 */
export function Home() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const version = useUi((s) => s.version);
  const ui = useUi();
  const isPro = usePurchases((s) => s.isPro);
  const s = useSettings();
  const [open, setOpen] = useState<Episode | null>(null);
  const [flaresMonth, setFlaresMonth] = useState(0);
  const [trend, setTrend] = useState<{ now: number | null; before: number | null; nNow: number }>({ now: null, before: null, nNow: 0 });
  const [series, setSeries] = useState<{ date: string; v: number }[]>([]);
  const [today, setToday] = useState<DailyCheckin | null>(null);
  const [editing, setEditing] = useState(false);
  const [extra, setExtra] = useState<Extra>({});
  const [items, setItems] = useState<Item[]>([]);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const day = localDay();

  const load = useCallback(async () => {
    const { fromIso, toIso } = monthRange();
    const o = await openEpisode(); setOpen(o);
    const nFlares = (await listEpisodes(fromIso, toIso)).length; setFlaresMonth(nFlares);
    const tr = await checkinTrend("gut", 7); setTrend(tr);
    const from = new Date(); from.setDate(from.getDate() - 13);
    setSeries(await checkinSeries("gut", localDay(from), day));
    const c = await getCheckin(day); setToday(c);
    const ex: Extra = c?.extra ? (JSON.parse(c.extra) as Extra) : {};
    setExtra(ex);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const dayFrom = start.toISOString(), dayTo = new Date(start.getTime() + 864e5).toISOString();
    const meals: MealWithItems[] = await listMeals(dayFrom, dayTo);
    const stools: Stool[] = await listStools(dayFrom, dayTo);
    const flares = await listEpisodes(dayFrom, dayTo);
    setItems([
      ...meals.map((m) => ({ at: m.at, kind: "meal" as const, id: m.id, title: t("meal.title"), sub: m.items.map((i) => foodName(t, i)).join(", ") || t("meal.empty") })),
      ...stools.map((x) => ({ at: x.at, kind: "stool" as const, id: x.id, title: t("stool.title"), sub: [x.bristol ? t("stool.typeShort", { n: x.bristol }) : null, x.urgency ? t("stool.urgency") : null, x.blood ? t("stool.blood") : null].filter(Boolean).join(" · ") })),
      ...flares.map((e) => ({ at: e.startedAt, kind: "flare" as const, id: e.id, title: t("episode.title"), sub: e.endedAt ? t("episode.duration", { h: hours(e.startedAt, e.endedAt).toFixed(1) }) : t("home.ongoing") })),
    ].sort((a, b) => b.at.localeCompare(a.at)));
    setChallenge(await activeChallenge());
    void publishWidget({ open: !!o, today: typeof ex.gut === "number" ? ex.gut : null, avg7: tr.now, flares: nFlares, t, lang });
    if (isPro) await applyOnboardingWishes();
  }, [day, t, lang, isPro]);
  useEffect(() => { void load(); }, [load, version]);

  const gut = typeof extra.gut === "number" ? extra.gut : null;
  const onFlare = async () => { const e = await startEpisode(); haptics.thud(); ui.bump(); ui.openEpisode(e.id, "quick"); };
  const onMeal = async () => { const id = await createMeal(); haptics.tap(); ui.openMeal(id); };
  const onStool = async () => { const id = await createStool(); haptics.tap(); ui.openStool(id); };
  const saveDay = async () => {
    if (gut == null) return;
    await setCheckin(day, statusFor(gut), extra, today?.note ?? null);
    haptics.success(); setEditing(false); ui.bump();
  };
  const saved = !!today && !editing && gut != null;
  const f1 = (n: number) => n.toLocaleString(lang, { maximumFractionDigits: 1 });
  const delta = trend.now != null && trend.before != null ? trend.now - trend.before : null;
  const summary = () => {
    const parts: string[] = [];
    for (const k of sideFields) if (typeof extra[k] === "number") parts.push(`${t(`home.fields.${k}`)} ${extra[k]}`);
    if (extra.period) parts.push(t("home.periodShort"));
    return parts.join(" · ");
  };
  const elim = eliminationProgress(s.fodmapPhase, s.phaseStart, s.eliminationWeeks);
  const cd = challenge ? challengeDay(challenge) : null;
  const done = challenge ? doneDaysOf(challenge) : [];
  const testFood = challenge ? (challenge.foodKey ? t(`food.items.${challenge.foodKey}`) : challenge.foodName ?? "") : "";

  return (
    <section className="screen">
      <div className="hero">
        <p className="eyebrow">{new Date().toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1>{s.userName ? t("home.greeting", { name: s.userName }) : t("home.title")}</h1>
      </div>

      {challenge && cd && cd.kind !== "after" ? (
        <div className="card col phase-card test">
          <span className="eyebrow">{t("test.activeEyebrow", { group: t(`fodmap.group.${challenge.groupKey}`) })}</span>
          {cd.kind === "test" ? (
            <>
              <strong>{t("test.todayPortion", { day: cd.day + 1, of: TEST_DAYS, portion: t(`test.portion.${cd.day}`), food: testFood })}</strong>
              <button type="button" className={`chip ${done[cd.day] ? "on" : ""}`} style={{ alignSelf: "flex-start" }} onClick={async () => { await setDoneDay(challenge, cd.day, !done[cd.day]); haptics.tap(); ui.bump(); }}>
                {done[cd.day] ? `✓ ${t("test.eaten")}` : t("test.markEaten")}</button>
            </>
          ) : cd.kind === "washout" ? (
            <><strong>{t("test.washout", { day: cd.day + 1, of: WASHOUT_DAYS })}</strong><span className="muted small">{t("test.washoutHint")}</span></>
          ) : <strong>{t("test.startsOn", { food: testFood })}</strong>}
        </div>
      ) : challenge && cd?.kind === "after" ? (
        <div className="card col phase-card test"><strong>{t("test.howDidItGo", { food: testFood })}</strong><span className="muted small">{t("test.seeTestTab")}</span></div>
      ) : elim ? (
        <div className="card col phase-card">
          <span className="eyebrow">{t("phase.elimination")}</span>
          <strong>{elim.done ? t("phase.elimDone") : t("phase.dayOf", { day: elim.day, of: elim.of })}</strong>
          <div className="progress"><i style={{ width: `${Math.min(100, (elim.day / elim.of) * 100)}%` }} /></div>
          {elim.done && <span className="muted small">{t("test.seeTestTab")}</span>}
        </div>
      ) : null}

      {saved ? (
        <div className="card today-saved">
          <div className="today-n">{gut}</div>
          <div className="grow"><strong>{t("home.todayIs", { word: t(`gutScale.level.${gutWord(gut!)}`).toLowerCase() })}</strong>
            <div className="muted small">{summary() || t("home.savedDay")}</div></div>
          <button className="ghost" onClick={() => setEditing(true)}>{t("common.edit")}</button>
        </div>
      ) : (
        <div className="card col checkin-card">
          <div className="row between"><strong className="q">{t("gutScale.question")}</strong>
            <button type="button" className="linklike small" onClick={() => ui.openInfo("gut")} aria-label={t("gutScale.infoTitle")}>ⓘ</button></div>
          <GutScale value={gut} onChange={(v) => setExtra({ ...extra, gut: v })} />
          {sideFields.map((k) => (
            <div className="field" key={k}>
              <span>{t(`home.fields.${k}`)} <em className="muted scale-hint">{t(`home.fieldHint.${k}`)}</em></span>
              <div className="scale">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button key={v} className={extra[k] === v ? "on" : ""} onClick={() => { haptics.tap(); setExtra({ ...extra, [k]: v }); }}>{v}</button>
                ))}
              </div>
            </div>
          ))}
          <button className="cta" style={{ marginTop: 6 }} disabled={gut == null} onClick={saveDay}>{t("home.saveDay")}</button>
        </div>
      )}

      {s.cycleTracking && (
        <div className="period-row">
          <button type="button" className={`chip ${extra.period ? "on" : ""}`} onClick={async () => {
            const n: Extra = { ...extra, period: !extra.period }; setExtra(n); haptics.tap();
            if (today && typeof n.gut === "number") { await setCheckin(day, statusFor(n.gut), n, today.note); ui.bump(); }
          }}>{extra.period ? "✓ " : ""}{t("home.periodToday")}</button>
          <span className="muted small">{t("home.periodHint")}</span>
        </div>
      )}

      {open ? (
        <button type="button" className="louder live" onClick={() => ui.openEpisode(open.id, "live")}>
          <span className="louder-mark"><GutMark size={34} color="#fff" core="#fff" /></span>
          <span className="col-text"><strong>{t("home.openSince", { time: fmtTime(open.startedAt, lang) })}</strong><span className="small">{t("home.tapToEdit")}</span></span>
        </button>
      ) : (
        <button type="button" className="louder" onClick={onFlare}>
          <span className="louder-mark"><GutMark size={34} color="#fff" core="#FFE3C7" /></span>
          <span className="col-text"><strong>{t("home.actingUp")}</strong><span className="small">{t("home.actingUpHint")}</span></span>
        </button>
      )}
      <div className="log-row">
        <button type="button" className="log-btn meal" onClick={onMeal}><span className="ico"><PlateIcon /></span><span>{t("home.logMeal")}</span></button>
        <button type="button" className="log-btn stool" onClick={onStool}><span className="ico"><RollIcon /></span><span>{t("home.logStool")}</span></button>
      </div>

      <h2>{t("home.todayTitle")}</h2>
      {items.length === 0 ? <p className="muted small">{t("home.todayEmpty")}</p> : (
        <ul className="list timeline">
          {items.map((x) => (
            <li key={`${x.kind}-${x.id}`} className={`tap ${x.kind}`} onClick={() => (x.kind === "meal" ? ui.openMeal(x.id) : x.kind === "stool" ? ui.openStool(x.id) : ui.openEpisode(x.id, "full"))}>
              <span className="tl-time">{fmtTime(x.at, lang)}</span>
              <div className="grow"><strong>{x.title}</strong><small>{x.sub}</small></div>
              <span className="muted">›</span>
            </li>
          ))}
        </ul>
      )}

      <h2>{t("home.weekTitle")}</h2>
      <div className="stats">
        <div className="stat"><div className="n">{trend.now != null ? f1(trend.now) : "–"}</div><div className="l">{t("home.avg7")}</div></div>
        <div className={`stat ${delta != null && delta <= -0.4 ? "ok" : ""}`}>
          <div className="n">{delta == null ? "–" : `${delta > 0.05 ? "↑" : delta < -0.05 ? "↓" : "→"} ${f1(Math.abs(delta))}`}</div>
          <div className="l">{t("home.vsLastWeek")}</div>
        </div>
        <div className="stat" style={{ gridColumn: "1 / -1" }}><div className="n">{flaresMonth}</div><div className="l">{t("home.flaresMonth", { count: flaresMonth })}</div></div>
      </div>
      {series.length >= 2 ? <div className="card spark-card"><Spark data={series} days={14} height={90} lang={lang} /></div>
        : <p className="muted small">{t("home.sparkEmpty")}</p>}

      <button type="button" className="card tap redflag-link" onClick={() => ui.openInfo("redFlags")}>
        <span>{t("redFlags.link")}</span><span className="muted">›</span>
      </button>
      <p className="disclaimer">{t("common.disclaimer")}</p>
    </section>
  );
}
