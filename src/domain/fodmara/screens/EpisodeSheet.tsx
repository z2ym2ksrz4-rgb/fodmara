import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listEpisodes, updateEpisode, endEpisode, deleteEpisode, listTags, episodeTagIds, setEpisodeTags, tagUsage, episodeComparison,
  listMedications, listIntakes, logIntake, deleteIntake, diaryConfig, type Episode, type Tag, type Medication, type Intake,
} from "@/core/diary";
import { Sheet, haptics, fmtTime, toLocalInput, fromLocalInput, hours } from "@/core/ui";
import { useSettings } from "@/core/settings";
import { usePurchases, useProGate } from "@/core/purchases";
import { maybeAskForReview } from "@/core/review";
import { TagPicker } from "../components/TagPicker";
import { useUi } from "../store";
import { removeHealthSamples } from "../health";

/**
 * The flare-up sheet ("my gut is acting up") in four tempos:
 *  - quick   : right after "My gut is acting up" — one question (how bad?), everything else can wait.
 *  - live    : the flare-up is running — end it, set how bad, or open everything.
 *  - journey : when it has settled (or the user comes back) — 4 short steps with the user's 6 most used chips each,
 *              "more…" expands, every step can be skipped. Ends with this flare-up vs. your average (Pro).
 *  - full    : the complete editable form (start/end, slider, all chips, medication, note, delete).
 * All writes happen immediately; the modes only change what is on screen.
 */
export function EpisodeSheet() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const id = useUi((s) => s.episodeSheetId);
  const mode = useUi((s) => s.episodeSheetMode);
  const setMode = useUi((s) => s.setMode);
  const close = useUi((s) => s.closeEpisode);
  const bump = useUi((s) => s.bump);
  const settings = useSettings();
  const isPro = usePurchases((s) => s.isPro);
  const gate = useProGate();
  const [ep, setEp] = useState<Episode | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [meds, setMeds] = useState<Medication[]>([]);
  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [step, setStep] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [cmp, setCmp] = useState<Awaited<ReturnType<typeof episodeComparison>>>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const e = (await listEpisodes()).find((x) => x.id === id) ?? null;
    setEp(e); setNote(e?.note ?? "");
    setTags(await listTags()); setSel(new Set(await episodeTagIds(id))); setUsage(await tagUsage());
    setMeds(await listMedications()); setIntakes(await listIntakes(id));
  }, [id]);
  useEffect(() => { void load(); setConfirmDelete(false); setStep(0); setExpanded({}); setCmp(null); }, [load]);

  const groups = diaryConfig().tagGroups;
  // Journey order for a flare-up: what you feel, where, what you think set it off, what helped.
  const journeyGroups = useMemo(() => ["symptom", "location", "trigger", "relief"].map((k) => groups.find((g) => g.key === k)).filter((g): g is NonNullable<typeof g> => !!g), [groups]);
  const steps = useMemo(() => [...journeyGroups.map((g) => `tags:${g.key}`), "meds", "note", "done"], [journeyGroups]);

  if (!id || !ep) return null;
  const patch = async (p: Parameters<typeof updateEpisode>[1]) => { await updateEpisode(ep.id, p); setEp({ ...ep, ...p } as Episode); bump(); };
  const onTags = async (n: Set<string>) => { setSel(n); await setEpisodeTags(ep.id, [...n]); bump(); };
  const toggleTag = (tid: string) => { const n = new Set(sel); if (n.has(tid)) n.delete(tid); else n.add(tid); haptics.tap(); void onTags(n); };
  const onEnd = async () => {
    await endEpisode(ep.id); haptics.success();
    await settings.set("successEvents", settings.successEvents + 1); void maybeAskForReview();
    bump(); await load(); setStep(0); setMode("journey");
  };
  const onIntake = async (m: Medication) => { await logIntake(m.id, ep.id); haptics.tap(); setIntakes(await listIntakes(ep.id)); bump(); };
  const onDelete = async () => { void removeHealthSamples(ep.healthUuid); await deleteEpisode(ep.id); bump(); close(); };
  const dur = ep.endedAt ? hours(ep.startedAt, ep.endedAt) : null;
  const title = ep.endedAt ? t("episode.title") : t("episode.ongoing");

  // ---- quick: one question --------------------------------------------------------------------------------
  if (mode === "quick") {
    const pick = async (v: number) => { await patch({ intensity: v }); haptics.thud(); close(); };
    return (
      <Sheet open onClose={close} title={t("episode.ongoing")}>
        <p className="muted">{t("episode.quickIntro")}</p>
        <h3 style={{ marginTop: 14 }}>{t("episode.howBad")}</h3>
        <div className="bigchoice">
          {[{ v: 5, k: "mild" }, { v: 7, k: "moderate" }, { v: 9, k: "severe" }].map((o) => (
            <button key={o.k} type="button" className={`big ${o.k}`} onClick={() => pick(o.v)}>{t(`episode.level.${o.k}`)}</button>
          ))}
        </div>
        <button type="button" className="linklike" style={{ marginTop: 16 }} onClick={close}>{t("episode.laterLink")}</button>
      </Sheet>
    );
  }

  // ---- live: the flare-up is running — one screen: how bad now, end it, or edit everything ---------------------
  if (mode === "live") {
    const cur = ep.intensity == null ? null : ep.intensity <= 5 ? "mild" : ep.intensity <= 7 ? "moderate" : "severe";
    return (
      <Sheet open onClose={close} title={t("home.openSince", { time: fmtTime(ep.startedAt, i18n.language) })}>
        <button className="cta" style={{ marginTop: 4 }} onClick={onEnd}>{t("home.endFlare")}</button>
        <p className="muted small" style={{ marginTop: 10 }}>{t("episode.liveHint")}</p>
        {cur == null ? (
          <>
            <h3 style={{ marginTop: 14 }}>{t("episode.howBad")}</h3>
            <div className="bigchoice">
              {[{ v: 5, k: "mild" }, { v: 7, k: "moderate" }, { v: 9, k: "severe" }].map((o) => (
                <button key={o.k} type="button" className={`big ${o.k}`} onClick={() => { void patch({ intensity: o.v }); haptics.tap(); }}>{t(`episode.level.${o.k}`)}</button>
              ))}
            </div>
          </>
        ) : (
          <p className="muted" style={{ marginTop: 14 }}>{t("episode.intensity")}: <strong>{t(`episode.level.${cur}`)}</strong> · {ep.intensity}/10</p>
        )}
        <button type="button" className="linklike" style={{ marginTop: 16 }} onClick={() => setMode("full")}>{t("episode.editAll")}</button>
      </Sheet>
    );
  }

  // ---- journey: 4 short steps -------------------------------------------------------------------------------
  if (mode === "journey") {
    const cur = steps[step];
    const next = () => { haptics.tap(); if (step < steps.length - 1) setStep(step + 1); else close(); };
    const Dots = () => <div className="dots" style={{ marginBottom: 6 }}>{steps.map((s, i) => <span key={s} className={i === step ? "on" : i < step ? "done" : ""} />)}</div>;
    const Nav = ({ skip = true }: { skip?: boolean }) => (
      <div className="row between" style={{ marginTop: 18 }}>
        <button type="button" className="linklike" onClick={() => setMode("full")}>{t("episode.editAll")}</button>
        <div className="row tight">
          {skip && <button type="button" className="ghost" onClick={next}>{t("episode.skip")}</button>}
          <button type="button" onClick={next}>{step === steps.length - 1 ? t("common.done") : t("onboarding.next")}</button>
        </div>
      </div>
    );
    if (cur.startsWith("tags:")) {
      const gk = cur.slice(5);
      const all = tags.filter((x) => x.groupKey === gk && (!x.isHidden || sel.has(x.id)));
      const ranked = [...all].sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0) || a.sort - b.sort);
      const top = expanded[gk] ? ranked : ranked.filter((x, i) => i < 6 || sel.has(x.id));
      return (
        <Sheet open onClose={close} title={title}>
          <Dots />
          <h3>{t(`episode.journey.${gk}`, { defaultValue: t(`diary.groups.${gk}`) })}</h3>
          <div className="bigchips">
            {top.map((x) => <button key={x.id} type="button" className={`chip ${sel.has(x.id) ? "on" : ""}`} onClick={() => toggleTag(x.id)}>{x.labelKey ? t(x.labelKey) : x.label}</button>)}
            {!expanded[gk] && ranked.length > top.length && <button type="button" className="chip other" onClick={() => setExpanded({ ...expanded, [gk]: true })}>{t("episode.more", { n: ranked.length - top.length })}</button>}
          </div>
          {expanded[gk] && <TagPicker groupKey={gk} tags={[]} selected={sel} onChange={onTags} onTagAdded={async () => setTags(await listTags())} compact />}
          <Nav />
        </Sheet>
      );
    }
    if (cur === "meds") {
      return (
        <Sheet open onClose={close} title={title}>
          <Dots />
          <h3>{t("episode.journey.meds")}</h3>
          {meds.length === 0 ? (
            <button type="button" className="ghost" onClick={() => useUi.getState().setMedsOpen(true)}>{t("meds.addFirst")}</button>
          ) : (
            <div className="bigchips">
              {meds.map((m) => { const n = intakes.filter((i) => i.medicationId === m.id).length; return <button type="button" key={m.id} className={`chip ${n ? "on" : ""}`} onClick={() => onIntake(m)}>{m.name}{n ? ` ×${n}` : ""}</button>; })}
            </div>
          )}
          {intakes.length > 0 && <p className="muted small">{intakes.map((i) => `${i.name} ${fmtTime(i.takenAt, lang)}`).join(" · ")} · <button type="button" className="linklike" onClick={() => setMode("full")}>{t("common.edit")}</button></p>}
          <Nav />
        </Sheet>
      );
    }
    if (cur === "note") {
      return (
        <Sheet open onClose={close} title={title}>
          <Dots />
          <h3>{t("episode.journey.note")}</h3>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => patch({ note: note.trim() || null })} placeholder={t("episode.notePh")} />
          <Nav />
        </Sheet>
      );
    }
    // done: summary + comparison
    if (!cmp) void episodeComparison(ep.id).then(setCmp);
    const f1 = (n: number | null) => (n == null ? "–" : n.toLocaleString(lang, { maximumFractionDigits: 1 }));
    return (
      <Sheet open onClose={close} title={t("episode.doneTitle")}>
        <Dots />
        <p className="muted">{dur != null ? t("episode.duration", { h: dur.toFixed(1) }) : t("home.ongoing")}{ep.intensity ? ` · ${ep.intensity}/10` : ""} · {[...sel].length} {t("episode.tagsCount")}</p>
        {isPro ? (
          cmp && cmp.n >= 2 ? (
            <div className="card col">
              <strong>{t("episode.cmpTitle")}</strong>
              <div className="cmp">
                <div><span className="muted small">{t("episode.cmpThis")}</span><b>{f1(cmp.hours)} {t("report.hours").toLowerCase()} · {cmp.intensity ?? "–"}/10</b></div>
                <div><span className="muted small">{t("episode.cmpAvg", { n: cmp.n })}</span><b>{f1(cmp.avgHours)} {t("report.hours").toLowerCase()} · {f1(cmp.avgIntensity)}/10</b></div>
              </div>
            </div>
          ) : <p className="muted small">{t("episode.cmpNeedMore")}</p>
        ) : (
          <button type="button" className="card col tap" style={{ textAlign: "left", width: "100%" }} onClick={() => gate.allow("insights")}>
            <strong>{t("episode.cmpTitle")}</strong><span className="muted small">{t("episode.cmpLocked")}</span>
          </button>
        )}
        <Nav skip={false} />
      </Sheet>
    );
  }

  // ---- full ----------------------------------------------------------------------------------------------
  return (
    <Sheet open onClose={close} title={title} tall>
      {!ep.endedAt && <button className="cta" style={{ marginTop: 0 }} onClick={onEnd}>{t("home.endFlare")}</button>}

      <div className="row">
        <label className="field"><span>{t("episode.start")}</span>
          <input type="datetime-local" value={toLocalInput(ep.startedAt)} onChange={(e) => e.target.value && patch({ startedAt: fromLocalInput(e.target.value) })} />
        </label>
        {ep.endedAt && (
          <label className="field"><span>{t("episode.end")}</span>
            <input type="datetime-local" value={toLocalInput(ep.endedAt)} onChange={(e) => e.target.value && patch({ endedAt: fromLocalInput(e.target.value) })} />
          </label>
        )}
      </div>
      {dur != null && <p className="muted small">{t("episode.duration", { h: dur.toFixed(1) })}</p>}

      <div className="field">
        <span>{t("episode.intensity")} {ep.intensity != null ? `· ${ep.intensity}/10` : ""}</span>
        <input type="range" min={0} max={10} step={1} value={ep.intensity ?? 7} onChange={(e) => patch({ intensity: Number(e.target.value) })} />
        <div className="row between small muted"><span>{t("episode.mildLbl")}</span><span>{t("episode.severeLbl")}</span></div>
      </div>

      {groups.map((g) => (
        <TagPicker key={g.key} groupKey={g.key} tags={tags.filter((x) => x.groupKey === g.key)} selected={sel} onChange={onTags} onTagAdded={async () => setTags(await listTags())} />
      ))}

      <div className="field">
        <span>{t("meds.title")}</span>
        {meds.length === 0 ? (
          <button type="button" className="ghost" onClick={() => useUi.getState().setMedsOpen(true)}>{t("meds.addFirst")}</button>
        ) : (
          <div className="chips">
            {meds.map((m) => <button type="button" key={m.id} className="chip" onClick={() => onIntake(m)}>+ {m.name}</button>)}
          </div>
        )}
        {intakes.length > 0 && (
          <ul className="list" style={{ margin: "6px 0 0" }}>
            {intakes.map((i) => (
              <li key={i.id} className="tap" style={{ padding: "10px 14px" }}>
                <span>{i.name} <span className="muted small">{fmtTime(i.takenAt, lang)}</span></span>
                <button type="button" className="small ghost danger" onClick={async () => { await deleteIntake(i.id); setIntakes(await listIntakes(ep.id)); bump(); }}>×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="field"><span>{t("episode.note")}</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => patch({ note: note.trim() || null })} placeholder={t("episode.notePh")} />
      </label>

      <div className="row between" style={{ marginTop: 18 }}>
        {confirmDelete
          ? <button type="button" className="ghost danger" onClick={onDelete}>{t("episode.deleteConfirm")}</button>
          : <button type="button" className="linklike" onClick={() => setConfirmDelete(true)}>{t("common.delete")}</button>}
        <button type="button" onClick={close}>{t("common.done")}</button>
      </div>
    </Sheet>
  );
}
