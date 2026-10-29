import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/core/settings";
import { ensurePermission } from "@/core/notifications";
import { usePaywall } from "@/core/purchases";
import i18n, { SUPPORTED, type Lang } from "@/core/i18n";
import { haptics } from "@/core/ui";
import { WidgetPreview } from "@/domain/fodmara/components/WidgetPreview";
import { localDay } from "@/core/ui";
import { healthAvailable } from "@/domain/fodmara/health";

/**
 * Onboarding: (0) language + first name, (1-3) three short intro screens, widget intro, (setup) IBS type, diagnosis,
 * how long, where in the low-FODMAP process – printed on the report – plus when to see a doctor, (extras) Pro wishes.
 * Then notification permission and the paywall (user can always close it and use the free tier).
 */
export function Onboarding() {
  const { t } = useTranslation();
  const settings = useSettings();
  const showPaywall = usePaywall((s) => s.show);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(settings.userName ?? "");
  const [since, setSince] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [diagnosed, setDiagnosed] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [phaseStart, setPhaseStart] = useState(localDay());
  const [flagsOpen, setFlagsOpen] = useState(false);
  const [wantCycle, setWantCycle] = useState(false);
  const [wantHealth, setWantHealth] = useState(false);
  const intro = t("onboarding.steps", { returnObjects: true }) as { title: string; body: string }[];
  const total = intro.length + 4; // name, intro…, widget, setup, extras
  const SETUP = total - 2, EXTRAS = total - 1, WIDGET = intro.length + 1;
  const Dots = () => <div className="dots">{Array.from({ length: total }, (_, i) => <span key={i} className={i === step ? "on" : ""} />)}</div>;

  const finish = async () => {
    await settings.set("userName", name.trim() || null);
    const profile = { since: since ?? undefined, type: type ?? undefined, diagnosed: diagnosed ?? undefined };
    await settings.set("conditionProfile", since || type || diagnosed ? JSON.stringify(profile) : null);
    if (phase) { await settings.set("fodmapPhase", phase); if (phase === "elimination") await settings.set("phaseStart", phaseStart); }
    await settings.set("onboardingWishes", wantCycle || wantHealth ? JSON.stringify({ cycle: wantCycle, health: wantHealth }) : null);
    await ensurePermission();
    await settings.set("onboardingDone", true);
    showPaywall("onboarding");
  };
  const next = () => { haptics.tap(); setStep(step + 1); };

  if (step === 0) {
    return (
      <section className="screen onboarding">
        <Dots />
        <h1>{t("onboarding.welcome")}</h1>
        <p>{t("onboarding.welcomeBody")}</p>
        <label className="field"><span>{t("settings.language")}</span>
          <select value={settings.language} onChange={async (e) => { const l = e.target.value as Lang; await settings.set("language", l); await i18n.changeLanguage(l); }}>
            {SUPPORTED.map((l) => <option key={l} value={l}>{t(`lang.${l}`)}</option>)}
          </select>
        </label>
        <label className="field"><span>{t("onboarding.name")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("onboarding.namePh")} autoComplete="given-name" maxLength={40} />
        </label>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="cta" onClick={next}>{t("onboarding.next")}</button>
        </div>
      </section>
    );
  }

  if (step === WIDGET) {
    const steps = t("widget.stepsIos", { returnObjects: true }) as string[];
    return (
      <section className="screen onboarding">
        <Dots />
        <h1>{t("onboarding.widgetTitle")}</h1>
        <p>{t("onboarding.widgetBody")}</p>
        <WidgetPreview />
        <ol className="steps">{steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
        <p className="muted small">{t("onboarding.widgetLater")}</p>
        <div className="row">
          <button className="ghost" onClick={() => setStep(SETUP)}>{t("onboarding.skip")}</button>
          <button className="cta" onClick={next}>{t("onboarding.next")}</button>
        </div>
      </section>
    );
  }

  if (step === SETUP) {
    return (
      <section className="screen onboarding">
        <Dots />
        <h1>{t("onboarding.setupTitle", { name: name.trim() || "" }).trim()}</h1>
        <p className="muted small">{t("onboarding.setupBody")}</p>
        <div className="field"><span>{t("onboarding.typeQ")}</span>
          <div className="chips">{["diarrhoea", "constipation", "mixed", "unsure"].map((b) => <button key={b} type="button" className={`chip ${type === b ? "on" : ""}`} onClick={() => setType(type === b ? null : b)}>{t(`onboarding.type.${b}`)}</button>)}</div>
        </div>
        <div className="field"><span>{t("onboarding.diagnosedQ")}</span>
          <div className="chips">{["yes", "inProgress", "no"].map((b) => <button key={b} type="button" className={`chip ${diagnosed === b ? "on" : ""}`} onClick={() => setDiagnosed(diagnosed === b ? null : b)}>{t(`onboarding.diagnosed.${b}`)}</button>)}</div>
        </div>
        <div className="field"><span>{t("onboarding.sinceQ")}</span>
          <div className="chips">{["lt1y", "1to5y", "gt5y"].map((b) => <button key={b} type="button" className={`chip ${since === b ? "on" : ""}`} onClick={() => setSince(since === b ? null : b)}>{t(`onboarding.since.${b}`)}</button>)}</div>
        </div>
        <div className="field"><span>{t("onboarding.phaseQ")}</span>
          <div className="chips">{["notStarted", "elimination", "reintro", "personal"].map((b) => <button key={b} type="button" className={`chip ${phase === b ? "on" : ""}`} onClick={() => setPhase(phase === b ? null : b)}>{t(`phase.${b}`)}</button>)}</div>
          {phase === "elimination" && <label className="field"><span>{t("phase.started")}</span><input type="date" value={phaseStart} max={localDay()} onChange={(e) => e.target.value && setPhaseStart(e.target.value)} /></label>}
        </div>
        <button type="button" className={`card col tap ${diagnosed === "no" ? "warn" : ""}`} style={{ width: "100%", textAlign: "left" }} onClick={() => setFlagsOpen(!flagsOpen)}>
          <strong>{t("redFlags.link")}</strong>
          {diagnosed === "no" && <span className="small">{t("onboarding.newHint")}</span>}
          {flagsOpen && <ul className="plain small">{(t("redFlags.urgent", { returnObjects: true }) as string[]).concat(t("redFlags.soon", { returnObjects: true }) as string[]).map((x, i) => <li key={i}>{x}</li>)}</ul>}
        </button>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="cta" onClick={next}>{t("onboarding.next")}</button>
        </div>
      </section>
    );
  }

  if (step === EXTRAS) {
    return (
      <section className="screen onboarding">
        <Dots />
        <h1>{t("onboarding.extrasTitle")}</h1>
        <p className="muted">{t("onboarding.extrasBody")}</p>
        <label className="check"><input type="checkbox" checked={wantCycle} onChange={(e) => setWantCycle(e.target.checked)} /> {t("settings.cycleTracking")} <span className="pill pro">PRO</span></label>
        <small className="muted" style={{ display: "block", marginTop: -4, marginBottom: 10 }}>{t("settings.cycleHint")}</small>
        {healthAvailable() && (<>
          <label className="check"><input type="checkbox" checked={wantHealth} onChange={(e) => setWantHealth(e.target.checked)} /> {t("health.title")} <span className="pill pro">PRO</span></label>
          <small className="muted" style={{ display: "block", marginTop: -4, marginBottom: 10 }}>{t("health.hint")}</small>
        </>)}
        <p className="muted small" style={{ marginTop: 12 }}>{t("onboarding.extrasNote")}</p>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="cta" onClick={() => void finish()}>{t("onboarding.start")}</button>
        </div>
      </section>
    );
  }

  const s = intro[step - 1]!;
  return (
    <section className="screen onboarding">
      <Dots />
      <h1>{s.title}</h1>
      <p>{s.body}</p>
      <div className="row">
        <button className="ghost" onClick={() => setStep(SETUP)}>{t("onboarding.skip")}</button>
        <button className="cta" onClick={next}>{t("onboarding.next")}</button>
      </div>
    </section>
  );
}
