import { Capacitor } from "@capacitor/core";
import { getDb, dbWrite, nowIso } from "@/core/db";
import { episodesNeedingHealthSync, markHealthSynced, clearHealthSync, episodeTagIds, listTags, type Episode } from "@/core/diary";
import { useSettings } from "@/core/settings";
import type { HealthSymptomKind } from "health-bridge";
import type { Stool } from "./data";

/**
 * Apple Health mirror (iOS only, Pro). A flare-up becomes one sample per gut symptom it carries (cramps, bloating,
 * diarrhoea, constipation, nausea, heartburn – the HealthKit symptom categories); a toilet visit with Bristol 6–7 becomes
 * a diarrhoea sample, 1–2 a constipation sample. Intensity 1–3 mild, 4–6 moderate, 7–10 severe. Idempotent: rows carry
 * the sample uuids (JSON) + sync time, so edits replace and nothing is written twice. Nothing is ever read from Health.
 */
export const healthAvailable = () => Capacitor.getPlatform() === "ios";

const KINDS: HealthSymptomKind[] = ["cramps", "bloating", "diarrhoea", "constipation", "nausea", "heartburn"];
const TAG_TO_KIND: Record<string, HealthSymptomKind> = { cramps: "cramps", pain: "cramps", bloating: "bloating", gas: "bloating", diarrhoea: "diarrhoea", constipation: "constipation", nausea: "nausea", heartburn: "heartburn" };
const severity = (i: number | null) => (i == null ? 0 : i <= 3 ? 2 : i <= 6 ? 3 : 4);
type Written = Partial<Record<HealthSymptomKind, string>>;
const parse = (s: string | null): Written => { try { return s ? (JSON.parse(s) as Written) : {}; } catch { return {}; } };

export async function requestHealthAccess(): Promise<boolean> {
  if (!healthAvailable()) return false;
  const { HealthBridge } = await import("health-bridge");
  const { available } = await HealthBridge.isAvailable();
  if (!available) return false;
  return (await HealthBridge.requestAuthorization()).granted;
}

async function kindsFor(e: Episode): Promise<HealthSymptomKind[]> {
  const ids = new Set(await episodeTagIds(e.id));
  const tags = (await listTags("symptom")).filter((t) => ids.has(t.id));
  const kinds = new Set<HealthSymptomKind>();
  for (const t of tags) { const k = TAG_TO_KIND[t.key]; if (k) kinds.add(k); }
  if (!kinds.size) kinds.add("cramps"); // a flare-up without symptom tags is still a gut episode
  return [...kinds];
}

/** Write every closed, unsynced (or edited) flare-up and toilet visit. Returns how many samples were written. */
export async function syncHealth(): Promise<number> {
  if (!healthAvailable() || !useSettings.getState().healthExport) return 0;
  const { HealthBridge } = await import("health-bridge");
  let n = 0;
  try {
    for (const e of await episodesNeedingHealthSync()) {
      const old = parse(e.healthUuid); const next: Written = {};
      for (const kind of await kindsFor(e)) {
        const { uuid } = await HealthBridge.writeSymptom({ kind, start: e.startedAt, end: e.endedAt!, severity: severity(e.intensity), replaceUuid: old[kind] ?? null });
        next[kind] = uuid; n++;
      }
      for (const kind of KINDS) if (old[kind] && !next[kind]) await HealthBridge.deleteSample({ uuid: old[kind]!, kind }).catch(() => undefined);
      await markHealthSynced(e.id, JSON.stringify(next));
    }
    const stools = ((await getDb().query(`SELECT * FROM stool WHERE bristol IS NOT NULL AND (healthSyncedAt IS NULL OR healthSyncedAt < updatedAt)`)).values ?? []) as Stool[];
    for (const s of stools) {
      const old = parse(s.healthUuid); const kind: HealthSymptomKind | null = s.bristol! >= 6 ? "diarrhoea" : s.bristol! <= 2 ? "constipation" : null;
      const next: Written = {};
      if (kind) { const end = new Date(new Date(s.at).getTime() + 5 * 6e4).toISOString(); const { uuid } = await HealthBridge.writeSymptom({ kind, start: s.at, end, severity: s.urgency ? 3 : 2, replaceUuid: old[kind] ?? null }); next[kind] = uuid; n++; }
      for (const k of KINDS) if (old[k] && !next[k]) await HealthBridge.deleteSample({ uuid: old[k]!, kind: k }).catch(() => undefined);
      await dbWrite(`UPDATE stool SET healthUuid=?, healthSyncedAt=? WHERE id=?`, [JSON.stringify(next), nowIso(), s.id]);
    }
  } catch (err) { console.warn("[health] sync stopped", err); }
  return n;
}

/** Deleting an entry: remove its samples too (best effort). */
export async function removeHealthSamples(healthUuid: string | null) {
  if (!healthAvailable() || !healthUuid) return;
  try { const { HealthBridge } = await import("health-bridge"); for (const [kind, uuid] of Object.entries(parse(healthUuid))) await HealthBridge.deleteSample({ uuid: uuid!, kind: kind as HealthSymptomKind }); } catch { /* best effort */ }
}

/** Turning the toggle off: forget sync state so a later re-enable writes everything again (samples stay in Health). */
export async function resetHealthSync() { await clearHealthSync(); await dbWrite(`UPDATE stool SET healthUuid=NULL, healthSyncedAt=NULL`); }
