import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { TFunction } from "i18next";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { listEpisodes, episodeSummary, tagFrequency, listTags, episodeTagIds, listIntakes, dbWrite, newId, nowIso } from "./reportDeps";
import { fmtDate, fmtTime, hours } from "@/core/ui";
import appConfig from "../../../app.config.json";

const BRAND: [number, number, number] = [36, 69, 60];
const ACCENT: [number, number, number] = [228, 128, 86];
const INK: [number, number, number] = [26, 30, 40];
const MUTED: [number, number, number] = [106, 112, 128];
const LINE: [number, number, number] = [222, 224, 232];
type AT = { lastAutoTable: { finalY: number } };

export type WeekRow = { from: string; gut: number | null; bloating: number | null; pain: number | null; sleep: number | null; stress: number | null; days: number; flares: number; stools: number };
export type ChallengeRow = { group: string; food: string; start: string; result: string; before: number | null; test: number | null; flares: number; note: string };
export type MealRow = { name: string; withN: number; withShare: number; otherShare: number };

/**
 * The dietitian/GP report: who (profile line), the period at a glance (gut score, bloating, hard days, flare-ups, meals,
 * toilet visits), gut score per week as a chart and a table, plain-word observations, reintroduction results, meals
 * followed by flare-ups, Bristol types, the user's own notes, one row per flare-up and shares of symptoms, triggers and
 * what helped. Plain facts only – no scores, no interpretation.
 */
export async function buildReport(fromIso: string, toIso: string, t: TFunction, lang: string, opts: {
  name?: string | null; profile?: string | null; notes?: string | null; weeks: WeekRow[]; day: { gut: number | null; bloating: number | null; logged: number; hard: number };
  learning?: string[]; meals: number; stools: { total: number; types: number[]; urgency: number; blood: number }; challenges: ChallengeRow[]; mealRows: MealRow[];
}): Promise<jsPDF> {
  const eps = (await listEpisodes(fromIso, toIso)).reverse();
  const sum = await episodeSummary(fromIso, toIso);
  const freq = await tagFrequency(fromIso, toIso);
  const tags = new Map((await listTags()).map((x) => [x.id, x]));
  const label = (id: string) => { const x = tags.get(id); return x ? (x.labelKey ? t(x.labelKey) : x.label ?? "") : ""; };
  const fmt1 = (n: number | null) => (n == null ? "–" : n.toLocaleString(lang, { maximumFractionDigits: 1 }));

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), M = 16;
  doc.setFillColor(...BRAND); doc.rect(0, 0, W, 30, "F"); doc.setFillColor(...ACCENT); doc.rect(0, 30, W, 1.4, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text(t("report.title"), M, 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
  const period = `${fmtDate(fromIso, lang, { day: "numeric", month: "long", year: "numeric" })} – ${fmtDate(new Date(new Date(toIso).getTime() - 1).toISOString(), lang, { day: "numeric", month: "long", year: "numeric" })}`;
  doc.text(opts.name ? `${opts.name} · ${period}` : period, M, 22);
  let y = 40;
  if (opts.profile) { doc.setTextColor(...MUTED); doc.setFontSize(9.5); doc.text(opts.profile, M, y); y += 6; }

  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: "plain",
    body: [
      [t("insights.avgGut"), `${fmt1(opts.day.gut)} / 10`], [t("insights.avgBloating"), `${fmt1(opts.day.bloating)} / 5`],
      [t("report.daysLogged"), String(opts.day.logged)], [t("report.hardDays"), String(opts.day.hard)],
      [t("insights.flares"), String(sum.episodes)], [t("insights.avgFlareHours"), fmt1(sum.avgHours)],
      [t("report.mealsLogged"), String(opts.meals)], [t("report.stoolsLogged"), String(opts.stools.total)],
      ...(opts.stools.blood ? [[t("report.bloodNoted"), String(opts.stools.blood)]] : []),
    ],
    styles: { fontSize: 10, cellPadding: 1.8, textColor: INK }, columnStyles: { 0: { textColor: MUTED, cellWidth: 70 }, 1: { fontStyle: "bold" } },
  });
  y = (doc as unknown as AT).lastAutoTable.finalY + 8;

  // ---- weekly gut-score bars (0–10) with flare-up counts above ---------------------------------------------------
  const weeks = opts.weeks;
  if (weeks.length >= 2) {
    doc.setTextColor(...BRAND); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(t("report.chartTitle"), M, y + 4); y += 8;
    const chartH = 36, chartW = W - 2 * M, base = y + chartH;
    const slot = chartW / weeks.length, bw = Math.min(9, slot * 0.6);
    doc.setDrawColor(...LINE); doc.line(M, base, M + chartW, base); doc.line(M, base - chartH / 2, M + chartW, base - chartH / 2);
    weeks.forEach((w, i) => {
      const x = M + i * slot + slot / 2;
      if (w.gut != null) { const h = (w.gut / 10) * chartH; doc.setFillColor(...BRAND); doc.rect(x - bw / 2, base - h, bw, h, "F"); doc.setFontSize(6.5); doc.setTextColor(...INK); doc.text(fmt1(w.gut), x, base - h - 1, { align: "center" }); }
      if (w.flares) { doc.setFillColor(...ACCENT); doc.circle(x, base - chartH - 1.5, 1.2 + Math.min(2, w.flares * 0.4), "F"); }
      if (weeks.length <= 16 || i % 2 === 0) { doc.setFontSize(6.5); doc.setTextColor(...MUTED); doc.text(fmtDate(w.from, lang, { day: "numeric", month: "short" }), x, base + 4, { align: "center" }); }
    });
    y = base + 9;
    doc.setFontSize(7.5); doc.setFillColor(...BRAND); doc.rect(M, y - 2.5, 3, 3, "F"); doc.setTextColor(...MUTED); doc.text(t("report.legendGut"), M + 5, y);
    doc.setFillColor(...ACCENT); doc.circle(M + 61.5, y - 1, 1.5, "F"); doc.text(t("report.legendFlares"), M + 64, y);
    y += 9;
  }

  if (opts.learning?.length) {
    doc.setTextColor(...BRAND); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(t("insights.learnTitle"), M, y + 4); y += 8;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...INK);
    for (const l of opts.learning) { const lines = doc.splitTextToSize("• " + l, W - 2 * M) as string[]; doc.text(lines, M, y + 2); y += lines.length * 4.6 + 1.5; }
    doc.setFontSize(7.5); doc.setTextColor(...MUTED); const n = doc.splitTextToSize(t("insights.learnNote"), W - 2 * M) as string[]; doc.text(n, M, y + 3); y += n.length * 3.8 + 8;
  }

  if (opts.notes?.trim()) {
    doc.setTextColor(...BRAND); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(t("report.notesTitle"), M, y + 4); y += 8;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(opts.notes.trim(), W - 2 * M) as string[];
    doc.text(lines, M, y + 2); y += lines.length * 5 + 8;
  }

  const section = (title: string, head: string[], rows: string[][], empty: string, widths?: Record<number, { cellWidth: number }>) => {
    doc.setTextColor(...BRAND); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(title, M, y + 4); y += 7;
    autoTable(doc, {
      startY: y, margin: { left: M, right: M }, head: [head], body: rows.length ? rows : [[empty]],
      theme: "grid", styles: { fontSize: 8.5, cellPadding: 1.6, textColor: INK, lineColor: LINE, lineWidth: 0.2, overflow: "linebreak" },
      headStyles: { fillColor: [233, 236, 243], textColor: INK, fontStyle: "bold" }, alternateRowStyles: { fillColor: [248, 249, 252] }, columnStyles: widths,
    });
    y = (doc as unknown as AT).lastAutoTable.finalY + 8;
  };

  if (opts.challenges.length) {
    section(t("report.challenges"), [t("report.group"), t("report.testFood"), t("report.started"), t("report.result"), t("report.gutBefore"), t("report.gutTest"), t("insights.flares"), t("episode.note")],
      opts.challenges.map((c) => [c.group, c.food, fmtDate(c.start + "T12:00:00", lang), c.result, fmt1(c.before), fmt1(c.test), String(c.flares), c.note]), "–");
  }

  section(t("report.weeks"), [t("report.week"), t("report.gutShort"), t("home.fields.bloating"), t("home.fields.pain"), t("home.fields.sleep"), t("home.fields.stress"), t("report.daysShort"), t("insights.flares"), t("report.stoolsShort")],
    weeks.map((w) => [fmtDate(w.from, lang, { day: "numeric", month: "short" }), fmt1(w.gut), fmt1(w.bloating), fmt1(w.pain), fmt1(w.sleep), fmt1(w.stress), String(w.days), String(w.flares), String(w.stools)]),
    t("insights.noData"));
  doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.text(t("report.scaleNote"), M, y - 4); y += 2;

  if (opts.stools.total) {
    section(t("insights.bristolTitle"), [1, 2, 3, 4, 5, 6, 7].map(String).concat(t("stool.urgency")), [[...opts.stools.types.map(String), String(opts.stools.urgency)]], "–");
  }
  if (opts.mealRows.length) {
    section(t("insights.mealsTitle"), [t("report.foodOrGroup"), t("report.mealsWith"), t("report.followedWith"), t("report.followedOther")],
      opts.mealRows.map((m) => [m.name, String(m.withN), `${Math.round(m.withShare * 100)}%`, `${Math.round(m.otherShare * 100)}%`]), "–");
    doc.setFontSize(7.5); doc.setTextColor(...MUTED); const n = doc.splitTextToSize(t("insights.mealPatNote"), W - 2 * M) as string[]; doc.text(n, M, y - 4); y += n.length * 3.8;
  }

  const rows: string[][] = [];
  for (const e of eps) {
    const ids = await episodeTagIds(e.id);
    const byGroup = (g: string) => ids.map((id) => tags.get(id)).filter((x) => x && x.groupKey === g).map((x) => label(x!.id)).join(", ");
    const meds = (await listIntakes(e.id)).map((i) => `${i.name} ${fmtTime(i.takenAt, lang)}`).join(", ");
    rows.push([
      `${fmtDate(e.startedAt, lang)} ${fmtTime(e.startedAt, lang)}`,
      e.endedAt ? fmt1(hours(e.startedAt, e.endedAt)) : "–",
      e.intensity != null ? String(e.intensity) : "–",
      [byGroup("symptom"), byGroup("location")].filter(Boolean).join(" · "), byGroup("trigger"), [byGroup("relief"), meds].filter(Boolean).join(" · "), e.note ?? "",
    ]);
  }
  section(t("report.flares"), [t("episode.start"), t("report.hours"), t("report.peakShort"), t("diary.groups.symptom"), t("diary.groups.trigger"), t("report.helped"), t("episode.note")],
    rows, t("home.empty"), { 0: { cellWidth: 24 }, 1: { cellWidth: 11 }, 2: { cellWidth: 11 } });

  const share = (g: string) => freq.filter((f) => f.groupKey === g).slice(0, 10).map((f) => [f.labelKey ? t(f.labelKey) : f.label ?? "", `${f.n} (${f.total ? Math.round((f.n / f.total) * 100) : 0}%)`]);
  for (const g of ["symptom", "trigger", "relief"]) section(`${t(`diary.groups.${g}`)} · ${t("insights.shareOfFlares")}`, [t(`diary.groups.${g}`), t("report.count")], share(g), "–");

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(`${t("report.footer", { app: appConfig.appName })} · ${p}/${pages}`, W / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
  }
  await dbWrite(`INSERT INTO report(id,fromDate,toDate,fileName,createdAt,updatedAt) VALUES(?,?,?,?,?,?)`, [newId(), fromIso.slice(0, 10), toIso.slice(0, 10), null, nowIso(), nowIso()]);
  return doc;
}

export async function sharePdf(doc: jsPDF, filename: string, title: string) {
  if (Capacitor.getPlatform() === "web") { doc.save(filename); return; }
  const data = doc.output("datauristring").split(",")[1]!;
  const f = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
  await Share.share({ title, url: f.uri });
}
