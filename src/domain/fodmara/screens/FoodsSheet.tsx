import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, haptics } from "@/core/ui";
import { FOODS } from "../foods";
import { GROUPS, type FodmapGroup } from "../fodmap";
import { listCustomFoods, updateCustomFood, customGroups, type CustomFood } from "../data";
import { useUi } from "../store";

const fold = (s: string) => s.toLocaleLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Reference list: which FODMAP groups a food typically contains. Deliberately no portions, no traffic lights and no
 * "safe/unsafe" – the amount matters and the dietitian decides. Your own foods can be tagged with groups here.
 */
export function FoodsSheet() {
  const { t } = useTranslation();
  const open = useUi((s) => s.foodsOpen);
  const setOpen = useUi((s) => s.setFoodsOpen);
  const openInfo = useUi((s) => s.openInfo);
  const bump = useUi((s) => s.bump);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<FodmapGroup | null>(null);
  const [custom, setCustom] = useState<CustomFood[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const load = useCallback(async () => setCustom(await listCustomFoods()), []);
  useEffect(() => { if (open) void load(); }, [open, load]);

  const rows = useMemo(() => {
    const qf = fold(q.trim());
    return FOODS.map((f) => ({ ...f, name: t(`food.items.${f.key}`) }))
      .filter((f) => (!qf || fold(f.name).includes(qf)) && (!group || f.groups.includes(group)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [q, group, t]);
  if (!open) return null;
  const toggleGroup = async (c: CustomFood, g: FodmapGroup) => {
    const cur = customGroups(c); const next = cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g];
    haptics.tap(); await updateCustomFood(c.id, { groups: next }); await load(); bump();
  };

  return (
    <Sheet open onClose={() => setOpen(false)} title={t("foods.title")} tall>
      <p className="muted small">{t("foods.intro")} <button type="button" className="linklike small" onClick={() => openInfo("fodmap")}>{t("foods.what")}</button></p>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("meal.searchPh")} />
      <div className="chips" style={{ margin: "8px 0" }}>
        {GROUPS.map((g) => <button type="button" key={g} className={`chip ${group === g ? "on" : ""}`} onClick={() => setGroup(group === g ? null : g)}>{t(`fodmap.group.${g}`)}</button>)}
      </div>
      <ul className="list foods">
        {rows.map((f) => (
          <li key={f.key}>
            <strong>{f.name}</strong>
            <small>{f.groups.length ? f.groups.map((g) => t(`fodmap.group.${g}`)).join(" · ") : t("foods.noGroup")}{f.portion ? ` · ${t("foods.portion")}` : ""}</small>
          </li>
        ))}
        {!rows.length && <li className="muted">{t("foods.none")}</li>}
      </ul>
      {custom.length > 0 && (
        <>
          <h2>{t("foods.yours")}</h2>
          <ul className="list foods">
            {custom.map((c) => (
              <li key={c.id}>
                <div className="row between"><strong>{c.name}</strong>
                  <button type="button" className="linklike small" onClick={() => setEditing(editing === c.id ? null : c.id)}>{editing === c.id ? t("common.done") : t("common.edit")}</button></div>
                {editing === c.id ? (
                  <>
                    <div className="chips" style={{ marginTop: 6 }}>{GROUPS.map((g) => <button type="button" key={g} className={`chip ${customGroups(c).includes(g) ? "on" : ""}`} onClick={() => void toggleGroup(c, g)}>{t(`fodmap.group.${g}`)}</button>)}</div>
                    <button type="button" className="linklike small danger-link" onClick={async () => { await updateCustomFood(c.id, { isHidden: 1 }); setEditing(null); await load(); bump(); }}>{t("foods.hide")}</button>
                  </>
                ) : <small>{customGroups(c).length ? customGroups(c).map((g) => t(`fodmap.group.${g}`)).join(" · ") : t("foods.untagged")}</small>}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="disclaimer">{t("foods.disclaimer")}</p>
    </Sheet>
  );
}
