import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Sheet, haptics, toLocalInput, fromLocalInput } from "@/core/ui";
import { useSettings } from "@/core/settings";
import { maybeAskForReview } from "@/core/review";
import { FOODS } from "../foods";
import { CATS, GROUPS, type FoodCat } from "../fodmap";
import {
  getMeal, updateMeal, deleteMeal, setMealItems, listCustomFoods, addCustomFood, foodUsage, customGroups,
  type MealWithItems, type CustomFood,
} from "../data";
import { useUi } from "../store";

type Pick = { foodKey?: string | null; customFoodId?: string | null };
const pickId = (p: Pick) => (p.foodKey ? `k:${p.foodKey}` : `c:${p.customFoodId}`);

export const foodName = (t: TFunction, p: { foodKey?: string | null; customName?: string | null }) => (p.foodKey ? t(`food.items.${p.foodKey}`) : p.customName ?? "?");
/** Folds accents so "creme" finds "crème" and "aeble" is not needed for "æble" typed as "æb". */
const fold = (s: string) => s.toLocaleLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * A meal in five seconds: time, a few chips (your usual foods first, search for the rest, "Other…" for your own),
 * and a quiet line saying which FODMAP groups the plate typically contains. Writes immediately; an empty meal is
 * removed again when the sheet closes.
 */
export function MealSheet() {
  const { t } = useTranslation();
  const id = useUi((s) => s.mealId);
  const openMeal = useUi((s) => s.openMeal);
  const openInfo = useUi((s) => s.openInfo);
  const bump = useUi((s) => s.bump);
  const settings = useSettings();
  const [meal, setMeal] = useState<MealWithItems | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [custom, setCustom] = useState<CustomFood[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<FoodCat | null>(null);
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const m = await getMeal(id); setMeal(m);
    setPicks(m ? m.items.map((i) => ({ foodKey: i.foodKey, customFoodId: i.customFoodId })) : []);
    setNote(m?.note ?? ""); setCustom(await listCustomFoods()); setUsage(await foodUsage());
  }, [id]);
  useEffect(() => { void load(); setQuery(""); setCat(null); setConfirmDelete(false); }, [load]);

  const customById = useMemo(() => new Map(custom.map((c) => [c.id, c])), [custom]);
  const label = useCallback((p: Pick) => (p.foodKey ? t(`food.items.${p.foodKey}`) : customById.get(p.customFoodId ?? "")?.name ?? "?"), [t, customById]);
  const all: Pick[] = useMemo(() => [...FOODS.map((f) => ({ foodKey: f.key })), ...custom.map((c) => ({ customFoodId: c.id }))], [custom]);
  const results = useMemo(() => {
    const qf = fold(query.trim());
    if (qf) return all.filter((p) => fold(label(p)).includes(qf)).slice(0, 14);
    if (cat) return FOODS.filter((f) => f.cat === cat).map((f) => ({ foodKey: f.key }));
    return [];
  }, [query, cat, all, label]);
  const usual = useMemo(() => all.filter((p) => usage[pickId(p)]).sort((a, b) => (usage[pickId(b)] ?? 0) - (usage[pickId(a)] ?? 0)).slice(0, 10), [all, usage]);

  if (!id || !meal) return null;
  const selected = new Set(picks.map(pickId));
  const save = async (next: Pick[]) => { setPicks(next); await setMealItems(meal.id, next); bump(); };
  const toggle = (p: Pick) => { haptics.tap(); const k = pickId(p); void save(selected.has(k) ? picks.filter((x) => pickId(x) !== k) : [...picks, p]); };
  const addOwn = async () => {
    const name = query.trim(); if (!name) return;
    const cid = await addCustomFood(name); setCustom(await listCustomFoods()); setQuery("");
    await save([...picks, { customFoodId: cid }]);
  };
  const groups = [...new Set(picks.flatMap((p) => (p.foodKey ? FOODS.find((f) => f.key === p.foodKey)?.groups ?? [] : customGroups(customById.get(p.customFoodId ?? "") ?? ({ groups: null } as CustomFood)))))];
  const ordered = GROUPS.filter((g) => groups.includes(g));
  const close = async () => {
    if (!picks.length && !note.trim()) await deleteMeal(meal.id);
    else { await settings.set("successEvents", settings.successEvents + 1); void maybeAskForReview(); }
    bump(); openMeal(null);
  };
  // a plain render function, not a component: an inline component type would remount every chip on each render
  const chip = (p: Pick) => <button type="button" key={pickId(p)} className={`chip ${selected.has(pickId(p)) ? "on" : ""}`} onClick={() => toggle(p)}>{label(p)}</button>;

  return (
    <Sheet open onClose={() => void close()} title={t("meal.title")} tall>
      <label className="field"><span>{t("meal.when")}</span>
        <input type="datetime-local" value={toLocalInput(meal.at)} onChange={async (e) => { if (!e.target.value) return; const at = fromLocalInput(e.target.value); await updateMeal(meal.id, { at }); setMeal({ ...meal, at }); bump(); }} />
      </label>

      {picks.length > 0 && (
        <div className="field"><span>{t("meal.onPlate")}</span>
          <div className="chips">{picks.map((p) => <button type="button" key={pickId(p)} className="chip on" onClick={() => toggle(p)}>{label(p)} ×</button>)}</div>
          <p className="muted small groups-line">
            {ordered.length ? t("meal.contains", { groups: ordered.map((g) => t(`fodmap.group.${g}`)).join(" · ") }) : t("meal.containsNone")}
            {" "}<button type="button" className="linklike small" onClick={() => openInfo("fodmap")}>ⓘ</button>
          </p>
        </div>
      )}

      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("meal.searchPh")} aria-label={t("meal.searchPh")} />
      {query.trim() ? (
        <div className="chips" style={{ marginTop: 8 }}>
          {results.map((p) => chip(p))}
          <button type="button" className="chip other" onClick={() => void addOwn()}>+ {t("meal.addOwn", { name: query.trim() })}</button>
        </div>
      ) : (
        <>
          {usual.length > 0 && <div className="field"><span>{t("meal.usual")}</span><div className="chips">{usual.map((p) => chip(p))}</div></div>}
          <div className="field"><span>{t("meal.browse")}</span>
            <div className="chips">{CATS.map((c) => <button type="button" key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(cat === c ? null : c)}>{t(`food.cat.${c}`)}</button>)}</div>
          </div>
          {cat && <div className="chips">{results.map((p) => chip(p))}</div>}
        </>
      )}

      <label className="field"><span>{t("meal.note")}</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={async () => { await updateMeal(meal.id, { note: note.trim() || null }); bump(); }} placeholder={t("meal.notePh")} />
      </label>
      <p className="muted small">{t("meal.hint")}</p>

      <div className="row between" style={{ marginTop: 14 }}>
        {confirmDelete
          ? <button type="button" className="ghost danger" onClick={async () => { await deleteMeal(meal.id); bump(); openMeal(null); }}>{t("meal.deleteConfirm")}</button>
          : <button type="button" className="linklike" onClick={() => setConfirmDelete(true)}>{t("common.delete")}</button>}
        <button type="button" onClick={() => void close()}>{t("common.done")}</button>
      </div>
    </Sheet>
  );
}
