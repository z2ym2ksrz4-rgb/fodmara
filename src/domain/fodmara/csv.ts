import type { TFunction } from "i18next";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { listCheckins, listEpisodes, listTags, episodeTagIds } from "@/core/diary";
import { listMeals, listStools, listChallenges } from "./data";
import { foodName } from "./screens/MealSheet";
import appConfig from "../../../app.config.json";

/** Everything as one CSV (Pro): one row per check-in, meal, toilet visit, flare-up and test – for Excel or a dietitian's own tool. */
export async function exportCsv(t: TFunction, lang: string) {
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows: unknown[][] = [[t("csv.type"), t("csv.date"), t("csv.time"), t("csv.value"), t("csv.detail"), t("csv.note")]];
  const dt = (iso: string) => [iso.slice(0, 10), new Date(iso).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })];
  for (const c of await listCheckins("2000-01-01", "2999-12-31")) { const ex = JSON.parse(c.extra ?? "{}") as Record<string, number>; rows.push([t("csv.checkin"), c.date, "", ex.gut ?? "", Object.entries(ex).filter(([k]) => k !== "gut").map(([k, v]) => `${k}=${v}`).join(" "), c.note]); }
  for (const m of await listMeals()) rows.push([t("meal.title"), ...dt(m.at), m.items.map((i) => foodName(t, i)).join(", "), m.photoPath ? t("meal.photo") : "", m.note]);
  for (const s of await listStools()) rows.push([t("stool.title"), ...dt(s.at), s.bristol ?? "", [s.urgency ? t("stool.urgency") : "", s.incomplete ? t("stool.incomplete") : "", s.blood ? t("stool.blood") : ""].filter(Boolean).join(" "), s.note]);
  const tags = new Map((await listTags()).map((x) => [x.id, x.labelKey ? t(x.labelKey) : x.label ?? ""]));
  for (const e of await listEpisodes()) rows.push([t("episode.title"), ...dt(e.startedAt), e.intensity ?? "", (await episodeTagIds(e.id)).map((id) => tags.get(id)).join(", ") + (e.endedAt ? ` · ${t("csv.until")} ${dt(e.endedAt)[1]}` : ""), e.note]);
  for (const c of await listChallenges()) rows.push([t("test.title"), c.startDate, "", t(`fodmap.group.${c.groupKey}`), `${c.foodKey ? t(`food.items.${c.foodKey}`) : c.foodName ?? ""} · ${c.result ? t(`test.resultShort.${c.result}`) : c.status}`, c.note]);
  const csv = "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
  const name = `${appConfig.appSlug}-${new Date().toISOString().slice(0, 10)}.csv`;
  if (Capacitor.getPlatform() === "web") { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = name; a.click(); return; }
  const f = await Filesystem.writeFile({ path: name, data: csv, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: name, url: f.uri });
}
