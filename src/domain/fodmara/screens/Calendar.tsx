import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listEpisodes, listCheckins, diaryConfig, type Episode, type DailyCheckin } from "@/core/diary";
import { fmtTime, localDay, hours } from "@/core/ui";
import { useProGate } from "@/core/purchases";
import { useUi } from "../store";
import { sideFields } from "../config";
import { gutWord } from "../components/GutScale";
import { listMeals, listStools, type MealWithItems, type Stool } from "../data";
import { foodName } from "./MealSheet";

/** Month heatmap: colour = the day's gut score (0–10 → 4 steps); a dot marks days with a flare-up. The day view lists meals and toilet visits too. */
export function Calendar() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const version = useUi((s) => s.version);
  const openSheet = useUi((s) => s.openEpisode);
  const openMeal = useUi((s) => s.openMeal);
  const openStool = useUi((s) => s.openStool);
  const [meals, setMeals] = useState<MealWithItems[]>([]);
  const [stools, setStools] = useState<Stool[]>([]);
  const gate = useProGate();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [eps, setEps] = useState<Episode[]>([]);
  const [checkins, setCheckins] = useState<DailyCheckin[]>([]);
  const [sel, setSel] = useState<string | null>(null);

  const cursorKey = cursor.getTime();
  const { first, last } = useMemo(() => ({ first: new Date(cursorKey), last: new Date(new Date(cursorKey).getFullYear(), new Date(cursorKey).getMonth() + 1, 0) }), [cursorKey]);
  const load = useCallback(async () => {
    const from = new Date(first.getFullYear(), first.getMonth(), 1 - 7).toISOString();
    const to = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1).toISOString();
    setEps(await listEpisodes(from, to));
    setCheckins(await listCheckins(localDay(first), localDay(last)));
    setMeals(await listMeals(from, to)); setStools(await listStools(from, to));
  }, [first, last]);
  useEffect(() => { void load(); }, [load, version]);

  const byDay = useMemo(() => {
    const m = new Map<string, { gut: number | null; extra: Record<string, unknown>; eps: Episode[] }>();
    const get = (k: string) => m.get(k) ?? { gut: null, extra: {}, eps: [] };
    for (const e of eps) {
      const start = new Date(e.startedAt), end = new Date(e.endedAt ?? new Date().toISOString());
      for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d <= end; d.setDate(d.getDate() + 1)) {
        const k = localDay(d); const cur = get(k); if (!cur.eps.includes(e)) cur.eps.push(e); m.set(k, cur);
      }
    }
    for (const c of checkins) {
      const cur = get(c.date); let ex: Record<string, unknown> = {};
      try { ex = c.extra ? (JSON.parse(c.extra) as Record<string, unknown>) : {}; } catch { /* ignore */ }
      cur.extra = ex; cur.gut = typeof ex.gut === "number" ? ex.gut : null; m.set(c.date, cur);
    }
    return m;
  }, [eps, checkins]);

  const freeFloor = new Date(); freeFloor.setDate(freeFloor.getDate() - diaryConfig().freeHistoryDays);
  const monthLocked = !gate.isPro && last < freeFloor;
  const go = (delta: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    const nextLast = new Date(next.getFullYear(), next.getMonth() + 1, 0);
    if (!gate.isPro && nextLast < freeFloor && !gate.allow("history")) return;
    setCursor(next); setSel(null);
  };
  const dow = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, i + 1).toLocaleDateString(lang, { weekday: "short" }).slice(0, 2)); // Mon-first
  const lead = (first.getDay() + 6) % 7;
  const today = localDay();
  const cls = (k: string) => {
    const d = byDay.get(k); if (!d) return "";
    const heat = d.gut == null ? "" : d.gut <= 2 ? "h1" : d.gut <= 5 ? "h2" : d.gut <= 7 ? "h3" : "h4";
    return `${heat} ${d.eps.length ? "spike" : ""}`;
  };
  const selData = sel ? byDay.get(sel) : undefined;

  return (
    <section className="screen">
      <div className="cal-head">
        <button onClick={() => go(-1)} aria-label="prev">‹</button>
        <h1>{cursor.toLocaleDateString(lang, { month: "long", year: "numeric" })}</h1>
        <button onClick={() => go(1)} aria-label="next">›</button>
      </div>
      <div className="cal">
        {dow.map((d, i) => <div key={i} className="dow">{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} className="day blank" />)}
        {Array.from({ length: last.getDate() }, (_, i) => {
          const k = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button key={k} className={`day ${cls(k)} ${k === today ? "today" : ""} ${sel === k ? "sel" : ""} ${monthLocked ? "locked" : ""}`}
              onClick={() => { if (monthLocked && !gate.allow("history")) return; setSel(sel === k ? null : k); }}>{i + 1}</button>
          );
        })}
      </div>
      <div className="legend">
        <span><i style={{ background: "var(--heat-1)" }} />0–2</span><span><i style={{ background: "var(--heat-2)" }} />3–5</span>
        <span><i style={{ background: "var(--heat-3)" }} />6–7</span><span><i style={{ background: "var(--heat-4)" }} />8–10</span>
        <span><i className="dot" />{t("calendar.flare")}</span>
      </div>

      {sel && (
        <>
          <h2>{new Date(sel + "T12:00:00").toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" })}</h2>
          {selData?.gut != null ? (
            <div className="card col">
              <strong>{t("calendar.gut", { n: selData.gut, word: t(`gutScale.level.${gutWord(selData.gut)}`).toLowerCase() })}</strong>
              <span className="muted small">{sideFields.filter((k) => typeof selData.extra[k] === "number").map((k) => `${t(`home.fields.${k}`)} ${selData.extra[k] as number}`).join(" · ")}{selData.extra.period ? ` · ${t("home.periodShort")}` : ""}</span>
            </div>
          ) : <p className="muted small">{t("calendar.noCheckin")}</p>}
          {selData?.eps.length ? (
            <ul className="list">
              {selData.eps.map((e) => (
                <li key={e.id} className="tap" onClick={() => openSheet(e.id)}>
                  <div><strong>{t("episode.title")} · {fmtTime(e.startedAt, lang)}{e.endedAt ? ` – ${fmtTime(e.endedAt, lang)}` : ""}</strong>
                    <small>{e.endedAt ? t("episode.duration", { h: hours(e.startedAt, e.endedAt).toFixed(1) }) : t("home.ongoing")}{e.intensity != null ? ` · ${e.intensity}/10` : ""}</small></div>
                  <span className="muted">›</span>
                </li>
              ))}
            </ul>
          ) : null}
          {(() => {
            const dm = meals.filter((m) => localDay(new Date(m.at)) === sel), ds = stools.filter((x) => localDay(new Date(x.at)) === sel);
            if (!dm.length && !ds.length) return null;
            return (
              <ul className="list timeline">
                {[...dm.map((m) => ({ at: m.at, el: <li key={m.id} className="tap meal" onClick={() => openMeal(m.id)}><span className="tl-time">{fmtTime(m.at, lang)}</span><div className="grow"><strong>{t("meal.title")}</strong><small>{m.items.map((i) => foodName(t, i)).join(", ") || t("meal.empty")}</small></div><span className="muted">›</span></li> })),
                  ...ds.map((x) => ({ at: x.at, el: <li key={x.id} className="tap stool" onClick={() => openStool(x.id)}><span className="tl-time">{fmtTime(x.at, lang)}</span><div className="grow"><strong>{t("stool.title")}</strong><small>{[x.bristol ? t("stool.typeShort", { n: x.bristol }) : null, x.urgency ? t("stool.urgency") : null, x.blood ? t("stool.blood") : null].filter(Boolean).join(" · ")}</small></div><span className="muted">›</span></li> }))]
                  .sort((a, b) => a.at.localeCompare(b.at)).map((x) => x.el)}
              </ul>
            );
          })()}
        </>
      )}
    </section>
  );
}
