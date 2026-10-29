import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, haptics, toLocalInput, fromLocalInput } from "@/core/ui";
import { getStool, updateStool, deleteStool, type Stool } from "../data";
import { BristolPicker } from "../components/Bristol";
import { useUi } from "../store";
import { removeHealthSamples } from "../health";

/**
 * A toilet visit in one tap: the Bristol type (picked first, closes nothing), urgency, "not quite done", blood.
 * Blood is never just a checkbox – ticking it shows when to talk to a doctor straight away.
 */
export function StoolSheet() {
  const { t } = useTranslation();
  const id = useUi((s) => s.stoolId);
  const openStool = useUi((s) => s.openStool);
  const openInfo = useUi((s) => s.openInfo);
  const bump = useUi((s) => s.bump);
  const [s, setS] = useState<Stool | null>(null);
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const load = useCallback(async () => { if (!id) return; const x = await getStool(id); setS(x); setNote(x?.note ?? ""); }, [id]);
  useEffect(() => { void load(); setConfirmDelete(false); }, [load]);
  if (!id || !s) return null;
  const patch = async (p: Parameters<typeof updateStool>[1]) => { await updateStool(s.id, p); setS({ ...s, ...p } as Stool); bump(); };
  const close = async () => { if (s.bristol == null && !s.urgency && !s.incomplete && !s.blood && !note.trim()) await deleteStool(s.id); bump(); openStool(null); };
  const Toggle = ({ k, label }: { k: "urgency" | "incomplete" | "blood"; label: string }) => (
    <button type="button" className={`chip ${s[k] ? "on" : ""} ${k === "blood" ? "blood" : ""}`} onClick={() => { haptics.tap(); void patch({ [k]: s[k] ? 0 : 1 }); }}>{s[k] ? "✓ " : ""}{label}</button>
  );
  return (
    <Sheet open onClose={() => void close()} title={t("stool.title")}>
      <div className="row between"><h3 style={{ margin: "4px 0" }}>{t("stool.bristolQ")}</h3>
        <button type="button" className="linklike small" onClick={() => openInfo("bristol")} aria-label={t("stool.infoTitle")}>ⓘ</button></div>
      <BristolPicker value={s.bristol} onChange={(v) => void patch({ bristol: v })} />
      <div className="chips" style={{ marginTop: 12 }}>
        <Toggle k="urgency" label={t("stool.urgency")} />
        <Toggle k="incomplete" label={t("stool.incomplete")} />
        <Toggle k="blood" label={t("stool.blood")} />
      </div>
      {!!s.blood && (
        <button type="button" className="card bad col tap" style={{ width: "100%", textAlign: "left", marginTop: 10 }} onClick={() => openInfo("redFlags")}>
          <strong>{t("stool.bloodTitle")}</strong><span className="small">{t("stool.bloodBody")}</span>
        </button>
      )}
      <label className="field"><span>{t("stool.when")}</span>
        <input type="datetime-local" value={toLocalInput(s.at)} onChange={(e) => e.target.value && void patch({ at: fromLocalInput(e.target.value) })} />
      </label>
      <label className="field"><span>{t("episode.note")}</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => void patch({ note: note.trim() || null })} />
      </label>
      <div className="row between" style={{ marginTop: 14 }}>
        {confirmDelete
          ? <button type="button" className="ghost danger" onClick={async () => { void removeHealthSamples(s.healthUuid); await deleteStool(s.id); bump(); openStool(null); }}>{t("stool.deleteConfirm")}</button>
          : <button type="button" className="linklike" onClick={() => setConfirmDelete(true)}>{t("common.delete")}</button>}
        <button type="button" onClick={() => void close()}>{t("common.done")}</button>
      </div>
    </Sheet>
  );
}
