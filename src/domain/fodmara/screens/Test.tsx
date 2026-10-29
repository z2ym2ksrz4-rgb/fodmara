import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { haptics, localDay, fmtDate } from "@/core/ui";
import { useSettings } from "@/core/settings";
import { useProGate } from "@/core/purchases";
import { GROUPS, TEST_FOODS, TEST_DAYS, WASHOUT_DAYS, type FodmapGroup } from "../fodmap";
import {
  activeChallenge, listChallenges, startChallenge, setDoneDay, stopChallenge, finishChallenge, deleteChallenge, challengeDay, doneDaysOf,
  challengeStats, resultsByGroup, eliminationProgress, type Challenge, type ChallengeResult,
} from "../data";
import { useUi } from "../store";

const RESULTS: ChallengeResult[] = ["tolerated", "some", "reaction"];
const addDays = (date: string, n: number) => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + n); return localDay(d); };

/**
 * The reintroduction planner (Pro). One FODMAP group at a time: three test days with a small, medium and large
 * portion, then three washout days back on the elimination diet. The app shows plain numbers (gut score on the test
 * days vs. the week before, flare-ups during the test) and the user records the verdict with their dietitian.
 */
export function Test() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const gate = useProGate();
  const s = useSettings();
  const version = useUi((u) => u.version);
  const bump = useUi((u) => u.bump);
  const openInfo = useUi((u) => u.openInfo);
  const [active, setActive] = useState<Challenge | null>(null);
  const [history, setHistory] = useState<Challenge[]>([]);
  const [results, setResults] = useState<Record<FodmapGroup, Challenge | null> | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof challengeStats>> | null>(null);
  const [group, setGroup] = useState<FodmapGroup | null>(null);
  const [food, setFood] = useState<string | null>(null);
  const [ownFood, setOwnFood] = useState("");
  const [startTomorrow, setStartTomorrow] = useState(false);
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!gate.isPro) return;
    const a = await activeChallenge(); setActive(a);
    setStats(a ? await challengeStats(a) : null);
    setHistory((await listChallenges()).filter((c) => c.status !== "active"));
    setResults(await resultsByGroup());
  }, [gate.isPro]);
  useEffect(() => { void load(); }, [load, version]);

  const PhasePicker = () => {
    const elim = eliminationProgress(s.fodmapPhase, s.phaseStart, s.eliminationWeeks);
    return (
      <div className="card col">
        <strong>{t("phase.where")}</strong>
        <div className="segment">
          {(["elimination", "reintro", "personal"] as const).map((p) => (
            <button key={p} className={s.fodmapPhase === p ? "active" : ""} onClick={async () => {
              await s.set("fodmapPhase", p); if (p === "elimination" && !s.phaseStart) await s.set("phaseStart", localDay()); haptics.tap(); bump();
            }}>{t(`phase.${p}Short`)}</button>
          ))}
        </div>
        {s.fodmapPhase === "elimination" && (
          <div className="row">
            <label className="field"><span>{t("phase.started")}</span><input type="date" value={s.phaseStart ?? localDay()} onChange={(e) => e.target.value && void s.set("phaseStart", e.target.value).then(bump)} /></label>
            <label className="field"><span>{t("phase.weeks")}</span>
              <select value={s.eliminationWeeks} onChange={(e) => void s.set("eliminationWeeks", Number(e.target.value)).then(bump)}>
                {[2, 3, 4, 5, 6, 8].map((w) => <option key={w} value={w}>{t("phase.weeksN", { n: w })}</option>)}
              </select>
            </label>
          </div>
        )}
        {elim && <span className="muted small">{elim.done ? t("phase.elimDone") : t("phase.dayOf", { day: elim.day, of: elim.of })}</span>}
      </div>
    );
  };

  if (!gate.isPro) {
    return (
      <section className="screen">
        <h1>{t("test.title")}</h1>
        <p className="muted">{t("test.intro")}</p>
        <ol className="steps">{(t("fodmap.phases", { returnObjects: true }) as string[]).map((x, i) => <li key={i}>{x}</li>)}</ol>
        <div className="card col">
          <strong>{t("test.lockedTitle")}</strong>
          <p className="muted">{t("test.lockedBody")}</p>
          <button onClick={() => gate.allow("reintro")}>{t("plan.upgrade")}</button>
        </div>
        <button type="button" className="linklike small" onClick={() => openInfo("fodmap")}>{t("foods.what")}</button>
      </section>
    );
  }

  const foodLabel = (c: Challenge) => (c.foodKey ? t(`food.items.${c.foodKey}`) : c.foodName ?? "");
  const f1 = (n: number | null) => (n == null ? "–" : n.toLocaleString(lang, { maximumFractionDigits: 1 }));
  const start = async () => {
    if (!group || (!food && !ownFood.trim())) return;
    await startChallenge(group, food ? { key: food } : { name: ownFood.trim() }, startTomorrow ? addDays(localDay(), 1) : localDay());
    if (s.fodmapPhase !== "reintro") await s.set("fodmapPhase", "reintro");
    haptics.success(); setGroup(null); setFood(null); setOwnFood(""); bump();
  };

  return (
    <section className="screen">
      <h1>{t("test.title")}</h1>
      <PhasePicker />

      {active ? (() => {
        const cd = challengeDay(active); const done = doneDaysOf(active);
        const dots = Array.from({ length: TEST_DAYS + WASHOUT_DAYS }, (_, i) => i);
        const curIdx = cd.kind === "test" ? cd.day : cd.kind === "washout" ? TEST_DAYS + cd.day : cd.kind === "after" ? 99 : -1;
        return (
          <>
            <h2>{t("test.active")}</h2>
            <div className="card col test-card">
              <span className="eyebrow">{t(`fodmap.group.${active.groupKey}`)}</span>
              <strong className="q">{foodLabel(active)}</strong>
              <div className="test-days">
                {dots.map((i) => {
                  const isTest = i < TEST_DAYS;
                  return (
                    <button type="button" key={i} disabled={!isTest || active.status === "stopped"} className={`td ${isTest ? "t" : "w"} ${i === curIdx ? "cur" : ""} ${isTest && done[i] ? "done" : ""} ${i < curIdx ? "past" : ""}`}
                      onClick={async () => { if (!isTest) return; await setDoneDay(active, i, !done[i]); haptics.tap(); bump(); }}>
                      <span className="d">{fmtDate(addDays(active.startDate, i) + "T12:00:00", lang, { weekday: "short" })}</span>
                      <span className="p">{isTest ? t(`test.portionShort.${i}`) : t("test.pause")}</span>
                      {isTest && done[i] && <span className="ok">✓</span>}
                    </button>
                  );
                })}
              </div>
              <span className="muted small">{cd.kind === "test" ? t("test.todayPortion", { day: cd.day + 1, of: TEST_DAYS, portion: t(`test.portion.${cd.day}`), food: foodLabel(active) })
                : cd.kind === "washout" ? `${t("test.washout", { day: cd.day + 1, of: WASHOUT_DAYS })} ${t("test.washoutHint")}`
                : cd.kind === "before" ? t("test.startsOn", { food: foodLabel(active) }) : t("test.readyForResult")}</span>
              {stats && (stats.nTest > 0 || stats.flares > 0) && (
                <div className="cmp">
                  <div><span className="muted small">{t("test.gutBefore", { n: stats.nBefore })}</span><b>{f1(stats.before)} / 10</b></div>
                  <div><span className="muted small">{t("test.gutDuring", { n: stats.nTest })}</span><b>{f1(stats.test)} / 10</b></div>
                  <div style={{ gridColumn: "1 / -1" }}><span className="muted small">{t("test.flaresDuring")}</span><b>{stats.flares}</b></div>
                </div>
              )}
              {cd.kind === "test" && active.status === "active" && (
                <button type="button" className="ghost danger" onClick={async () => { await stopChallenge(active.id); bump(); }}>{t("test.stop")}</button>
              )}
            </div>
            {(cd.kind === "washout" || cd.kind === "after" || active.status === "stopped") && (
              <div className="card col">
                <strong>{t("test.resultQ")}</strong>
                <div className="bigchoice">
                  {RESULTS.map((r) => <button key={r} type="button" className={`big ${r === "tolerated" ? "mild" : r === "some" ? "moderate" : "severe"} ${result === r ? "on" : ""}`} onClick={() => setResult(r)}>{t(`test.result.${r}`)}</button>)}
                </div>
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("test.notePh")} />
                <button className="cta" disabled={!result} onClick={async () => { if (!result) return; await finishChallenge(active.id, result, note.trim() || null); setResult(null); setNote(""); haptics.success(); bump(); }}>{t("test.finish")}</button>
                <span className="muted small">{t("test.resultHint")}</span>
              </div>
            )}
            <button type="button" className="linklike small" onClick={async () => { if (!confirm(t("test.deleteConfirm"))) return; await deleteChallenge(active.id); bump(); }}>{t("test.delete")}</button>
          </>
        );
      })() : (
        <>
          <h2>{t("test.newTitle")}</h2>
          <div className="card col">
            <strong>{t("test.pickGroup")}</strong>
            <div className="chips">
              {GROUPS.map((g) => <button key={g} type="button" className={`chip ${group === g ? "on" : ""}`} onClick={() => { setGroup(g); setFood(null); }}>{t(`fodmap.group.${g}`)}{results?.[g] ? ` · ${t(`test.resultShort.${results[g]!.result ?? "reaction"}`)}` : ""}</button>)}
            </div>
            {group && (
              <>
                <span className="muted small">{t(`fodmap.groupHint.${group}`)}</span>
                <strong style={{ marginTop: 6 }}>{t("test.pickFood")}</strong>
                <div className="chips">
                  {TEST_FOODS[group].map((k) => <button key={k} type="button" className={`chip ${food === k ? "on" : ""}`} onClick={() => { setFood(k); setOwnFood(""); }}>{t(`food.items.${k}`)}</button>)}
                </div>
                <input value={ownFood} onChange={(e) => { setOwnFood(e.target.value); if (e.target.value) setFood(null); }} placeholder={t("test.ownFoodPh")} />
                <div className="segment">
                  <button className={!startTomorrow ? "active" : ""} onClick={() => setStartTomorrow(false)}>{t("test.startToday")}</button>
                  <button className={startTomorrow ? "active" : ""} onClick={() => setStartTomorrow(true)}>{t("test.startTomorrow")}</button>
                </div>
                <button className="cta" disabled={!food && !ownFood.trim()} onClick={() => void start()}>{t("test.start")}</button>
              </>
            )}
            <span className="muted small">{t("test.planHint")}</span>
          </div>
        </>
      )}

      <h2>{t("test.results")}</h2>
      <ul className="list results">
        {GROUPS.map((g) => {
          const c = results?.[g];
          return (
            <li key={g}>
              <div className="row between"><strong>{t(`fodmap.group.${g}`)}</strong>
                <span className={`pill res ${c?.result ?? "none"}`}>{c ? t(`test.resultShort.${c.result ?? "reaction"}`) : active?.groupKey === g ? t("test.testing") : t("test.notTested")}</span></div>
              {c && <small>{foodLabel(c)} · {fmtDate(c.startDate + "T12:00:00", lang)}{c.note ? ` · ${c.note}` : ""}</small>}
            </li>
          );
        })}
      </ul>
      {history.length > 0 && (
        <>
          <h2>{t("test.history")}</h2>
          <ul className="list">
            {history.map((c) => (
              <li key={c.id}><strong>{t(`fodmap.group.${c.groupKey}`)} · {foodLabel(c)}</strong>
                <small>{fmtDate(c.startDate + "T12:00:00", lang)} · {t(`test.resultShort.${c.result ?? "reaction"}`)}{c.status === "stopped" ? ` · ${t("test.stoppedEarly")}` : ""}</small></li>
            ))}
          </ul>
        </>
      )}
      <p className="disclaimer">{t("test.disclaimer")}</p>
    </section>
  );
}
