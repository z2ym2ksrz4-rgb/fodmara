import { getDb, dbWrite, newId, nowIso } from "@/core/db";
import { listEpisodes, listCheckins } from "@/core/diary";
import { localDay } from "@/core/ui";
import { FOOD_BY_KEY } from "./foods";
import { GROUPS, TEST_DAYS, WASHOUT_DAYS, type FodmapGroup } from "./fodmap";

const q = async <T,>(sql: string, params: unknown[] = []) => ((await getDb().query(sql, params)).values ?? []) as T[];

// ---- custom foods -----------------------------------------------------------------------------------------------

export type CustomFood = { id: string; name: string; groups: string | null; isHidden: number; updatedAt: string };
export const customGroups = (c: CustomFood): FodmapGroup[] => { try { return c.groups ? (JSON.parse(c.groups) as FodmapGroup[]) : []; } catch { return []; } };

export async function listCustomFoods(): Promise<CustomFood[]> { return q<CustomFood>(`SELECT * FROM customFood WHERE isHidden=0 ORDER BY name`); }
export async function addCustomFood(name: string, groups: FodmapGroup[] = []): Promise<string> {
  const id = newId();
  await dbWrite(`INSERT INTO customFood(id,name,groups,isHidden,updatedAt) VALUES(?,?,?,0,?)`, [id, name.trim(), JSON.stringify(groups), nowIso()]);
  return id;
}
export async function updateCustomFood(id: string, patch: { name?: string; groups?: FodmapGroup[]; isHidden?: number }) {
  const sets: string[] = [], vals: unknown[] = [];
  if (patch.name != null) { sets.push("name=?"); vals.push(patch.name.trim()); }
  if (patch.groups) { sets.push("groups=?"); vals.push(JSON.stringify(patch.groups)); }
  if (patch.isHidden != null) { sets.push("isHidden=?"); vals.push(patch.isHidden); }
  if (!sets.length) return;
  await dbWrite(`UPDATE customFood SET ${sets.join(", ")}, updatedAt=? WHERE id=?`, [...vals, nowIso(), id]);
}

// ---- meals ------------------------------------------------------------------------------------------------------

export type Meal = { id: string; at: string; note: string | null; photoPath: string | null; createdAt: string; updatedAt: string };
/** One item on a plate: a catalogue key or a custom food (name/groups resolved for display). */
export type MealItem = { id: string; mealId: string; foodKey: string | null; customFoodId: string | null; customName?: string | null; customGroups?: string | null };
export type MealWithItems = Meal & { items: MealItem[] };

export async function createMeal(at = nowIso()): Promise<string> {
  const id = newId(), now = nowIso();
  await dbWrite(`INSERT INTO meal(id,at,note,createdAt,updatedAt) VALUES(?,?,NULL,?,?)`, [id, at, now, now]);
  return id;
}
export async function updateMeal(id: string, patch: { at?: string; note?: string | null; photoPath?: string | null }) {
  const keys = Object.keys(patch) as (keyof typeof patch)[]; if (!keys.length) return;
  await dbWrite(`UPDATE meal SET ${keys.map((k) => `${k}=?`).join(", ")}, updatedAt=? WHERE id=?`, [...keys.map((k) => patch[k] ?? null), nowIso(), id]);
}
export async function deleteMeal(id: string) {
  await dbWrite(`DELETE FROM mealItem WHERE mealId=?`, [id]);
  await dbWrite(`DELETE FROM meal WHERE id=?`, [id]);
}
export async function setMealItems(mealId: string, items: { foodKey?: string | null; customFoodId?: string | null }[]) {
  await dbWrite(`DELETE FROM mealItem WHERE mealId=?`, [mealId]);
  for (const it of items) await dbWrite(`INSERT INTO mealItem(id,mealId,foodKey,customFoodId,updatedAt) VALUES(?,?,?,?,?)`, [newId(), mealId, it.foodKey ?? null, it.customFoodId ?? null, nowIso()]);
  await dbWrite(`UPDATE meal SET updatedAt=? WHERE id=?`, [nowIso(), mealId]);
}
export async function listMeals(fromIso?: string, toIso?: string): Promise<MealWithItems[]> {
  const where: string[] = [], params: unknown[] = [];
  if (fromIso) { where.push(`at >= ?`); params.push(fromIso); }
  if (toIso) { where.push(`at < ?`); params.push(toIso); }
  const meals = await q<Meal>(`SELECT * FROM meal ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY at DESC`, params);
  if (!meals.length) return [];
  const items = await q<MealItem>(
    `SELECT i.*, c.name AS customName, c.groups AS customGroups FROM mealItem i LEFT JOIN customFood c ON c.id=i.customFoodId
     WHERE i.mealId IN (${meals.map(() => "?").join(",")})`, meals.map((m) => m.id));
  return meals.map((m) => ({ ...m, items: items.filter((i) => i.mealId === m.id) }));
}
export async function getMeal(id: string): Promise<MealWithItems | null> {
  const m = (await q<Meal>(`SELECT * FROM meal WHERE id=?`, [id]))[0]; if (!m) return null;
  const items = await q<MealItem>(`SELECT i.*, c.name AS customName, c.groups AS customGroups FROM mealItem i LEFT JOIN customFood c ON c.id=i.customFoodId WHERE i.mealId=?`, [id]);
  return { ...m, items };
}
/** FODMAP groups present in an item (catalogue or the user's own tagging). */
export const itemGroups = (i: MealItem): FodmapGroup[] => {
  if (i.foodKey) return FOOD_BY_KEY.get(i.foodKey)?.groups ?? [];
  try { return i.customGroups ? (JSON.parse(i.customGroups) as FodmapGroup[]) : []; } catch { return []; }
};
export const mealGroups = (m: MealWithItems): FodmapGroup[] => [...new Set(m.items.flatMap(itemGroups))];
/** Stable id for "this food" across catalogue and custom foods (for usage counts and per-food patterns). */
export const itemId = (i: MealItem) => (i.foodKey ? `k:${i.foodKey}` : `c:${i.customFoodId}`);

/** All-time usage per food id, for "your usual" chips in the meal sheet. */
export async function foodUsage(): Promise<Record<string, number>> {
  const rows = await q<{ foodKey: string | null; customFoodId: string | null; n: number }>(`SELECT foodKey, customFoodId, COUNT(*) AS n FROM mealItem GROUP BY foodKey, customFoodId`);
  return Object.fromEntries(rows.map((r) => [r.foodKey ? `k:${r.foodKey}` : `c:${r.customFoodId}`, r.n]));
}

// ---- stools -----------------------------------------------------------------------------------------------------

export type Stool = { id: string; at: string; bristol: number | null; urgency: number; incomplete: number; blood: number; note: string | null; healthUuid: string | null; healthSyncedAt: string | null; updatedAt: string };
export async function createStool(at = nowIso()): Promise<string> {
  const id = newId();
  await dbWrite(`INSERT INTO stool(id,at,bristol,urgency,incomplete,blood,note,updatedAt) VALUES(?,?,NULL,0,0,0,NULL,?)`, [id, at, nowIso()]);
  return id;
}
export async function updateStool(id: string, patch: Partial<Pick<Stool, "at" | "bristol" | "urgency" | "incomplete" | "blood" | "note">>) {
  const keys = Object.keys(patch) as (keyof typeof patch)[]; if (!keys.length) return;
  await dbWrite(`UPDATE stool SET ${keys.map((k) => `${k}=?`).join(", ")}, updatedAt=? WHERE id=?`, [...keys.map((k) => patch[k] ?? null), nowIso(), id]);
}
export async function deleteStool(id: string) { await dbWrite(`DELETE FROM stool WHERE id=?`, [id]); }
export async function getStool(id: string): Promise<Stool | null> { return (await q<Stool>(`SELECT * FROM stool WHERE id=?`, [id]))[0] ?? null; }
export async function listStools(fromIso?: string, toIso?: string): Promise<Stool[]> {
  const where: string[] = [], params: unknown[] = [];
  if (fromIso) { where.push(`at >= ?`); params.push(fromIso); }
  if (toIso) { where.push(`at < ?`); params.push(toIso); }
  return q<Stool>(`SELECT * FROM stool ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY at DESC`, params);
}
/** Count per Bristol type 1–7 (index 0 = type 1) plus flags, in a range. */
export async function bristolSummary(fromIso: string, toIso: string) {
  const rows = await listStools(fromIso, toIso);
  const types = [0, 0, 0, 0, 0, 0, 0];
  for (const r of rows) if (r.bristol && r.bristol >= 1 && r.bristol <= 7) types[r.bristol - 1]++;
  return { total: rows.length, typed: types.reduce((a, b) => a + b, 0), types, urgency: rows.filter((r) => r.urgency).length, blood: rows.filter((r) => r.blood).length };
}

// ---- reintroduction challenges ----------------------------------------------------------------------------------

export type ChallengeResult = "tolerated" | "some" | "reaction";
export type Challenge = {
  id: string; groupKey: FodmapGroup; foodKey: string | null; foodName: string | null; startDate: string;
  status: "active" | "done" | "stopped"; result: ChallengeResult | null; doneDays: string | null; note: string | null; createdAt: string; updatedAt: string;
};
export const doneDaysOf = (c: Challenge): boolean[] => { try { const a = c.doneDays ? (JSON.parse(c.doneDays) as boolean[]) : []; return Array.from({ length: TEST_DAYS }, (_, i) => !!a[i]); } catch { return [false, false, false]; } };
const addDays = (date: string, n: number) => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + n); return localDay(d); };
const daysBetween = (a: string, b: string) => Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 864e5);

/** Where a challenge is on a given day: test day 0–2 (portion small/medium/large), washout 0–2, or finished. */
export function challengeDay(c: Challenge, today = localDay()): { kind: "before" } | { kind: "test"; day: number } | { kind: "washout"; day: number } | { kind: "after" } {
  const n = daysBetween(c.startDate, today);
  if (n < 0) return { kind: "before" };
  if (c.status === "stopped") { const stop = daysBetween(c.startDate, c.updatedAt.slice(0, 10)); const w = n - stop - 1; return w < 0 ? { kind: "test", day: Math.min(n, TEST_DAYS - 1) } : w < WASHOUT_DAYS ? { kind: "washout", day: w } : { kind: "after" }; }
  if (n < TEST_DAYS) return { kind: "test", day: n };
  if (n < TEST_DAYS + WASHOUT_DAYS) return { kind: "washout", day: n - TEST_DAYS };
  return { kind: "after" };
}
export const challengeEnd = (c: Challenge) => addDays(c.startDate, TEST_DAYS + WASHOUT_DAYS - 1);

export async function listChallenges(): Promise<Challenge[]> { return q<Challenge>(`SELECT * FROM challenge ORDER BY startDate DESC, createdAt DESC`); }
export async function activeChallenge(): Promise<Challenge | null> { return (await q<Challenge>(`SELECT * FROM challenge WHERE status='active' ORDER BY startDate DESC LIMIT 1`))[0] ?? null; }
export async function startChallenge(groupKey: FodmapGroup, food: { key?: string | null; name?: string | null }, startDate = localDay()): Promise<string> {
  const id = newId(), now = nowIso();
  await dbWrite(`INSERT INTO challenge(id,groupKey,foodKey,foodName,startDate,status,result,doneDays,note,createdAt,updatedAt) VALUES(?,?,?,?,?,'active',NULL,'[]',NULL,?,?)`,
    [id, groupKey, food.key ?? null, food.name ?? null, startDate, now, now]);
  return id;
}
export async function setDoneDay(c: Challenge, day: number, done: boolean) {
  const a = doneDaysOf(c); a[day] = done;
  await dbWrite(`UPDATE challenge SET doneDays=?, updatedAt=? WHERE id=?`, [JSON.stringify(a), nowIso(), c.id]);
}
/** Stop early (a clear reaction): no more test portions, washout starts tomorrow. */
export async function stopChallenge(id: string) { await dbWrite(`UPDATE challenge SET status='stopped', result=COALESCE(result,'reaction'), updatedAt=? WHERE id=?`, [nowIso(), id]); }
export async function finishChallenge(id: string, result: ChallengeResult, note: string | null = null) {
  await dbWrite(`UPDATE challenge SET status='done', result=?, note=?, updatedAt=? WHERE id=?`, [result, note, nowIso(), id]);
}
export async function deleteChallenge(id: string) { await dbWrite(`DELETE FROM challenge WHERE id=?`, [id]); }

/**
 * Descriptive numbers for one challenge: average gut score on the test days vs. the 7 days before it started,
 * and how many flare-ups began during the test days (+ the day after). No verdict – the user decides with the dietitian.
 */
export async function challengeStats(c: Challenge) {
  const before = await listCheckins(addDays(c.startDate, -7), addDays(c.startDate, -1));
  const test = await listCheckins(c.startDate, addDays(c.startDate, TEST_DAYS - 1));
  const gut = (rows: { extra: string | null }[]) => rows.map((r) => { try { return (JSON.parse(r.extra ?? "{}") as Record<string, number>).gut; } catch { return undefined; } }).filter((v): v is number => typeof v === "number");
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const from = new Date(c.startDate + "T00:00:00").toISOString(), to = new Date(addDays(c.startDate, TEST_DAYS + 1) + "T00:00:00").toISOString();
  const flares = (await listEpisodes(from, to)).length;
  const bg = gut(before), tg = gut(test);
  return { before: avg(bg), test: avg(tg), nBefore: bg.length, nTest: tg.length, flares };
}

/** Latest finished result per group (the results matrix). */
export async function resultsByGroup(): Promise<Record<FodmapGroup, Challenge | null>> {
  const all = (await listChallenges()).filter((c) => c.status !== "active");
  return Object.fromEntries(GROUPS.map((g) => [g, all.find((c) => c.groupKey === g) ?? null])) as Record<FodmapGroup, Challenge | null>;
}

// ---- meals → symptoms (descriptive) -----------------------------------------------------------------------------

export type MealPattern = { key: string; kind: "group" | "food"; foodKey?: string | null; customName?: string | null; withN: number; withShare: number; otherN: number; otherShare: number };

/**
 * For each FODMAP group (and each food eaten ≥4 times): the share of meals followed by a flare-up within 2–24 h,
 * compared with all other meals. Needs ≥4 meals on each side. Descriptive only – a meal eaten before a flare is not its cause.
 */
export async function mealPatterns(days = 180): Promise<{ groups: MealPattern[]; foods: MealPattern[]; meals: number }> {
  const from = new Date(Date.now() - days * 864e5).toISOString();
  const meals = await listMeals(from);
  const flares = (await listEpisodes(from)).map((e) => new Date(e.startedAt).getTime());
  const followed = (m: Meal) => { const t = new Date(m.at).getTime(); return flares.some((f) => f - t >= 2 * 36e5 && f - t <= 24 * 36e5); };
  const flag = new Map(meals.map((m) => [m.id, followed(m)]));
  const share = (ms: MealWithItems[]) => (ms.length ? ms.filter((m) => flag.get(m.id)).length / ms.length : 0);
  const groups: MealPattern[] = [];
  for (const g of GROUPS) {
    const w = meals.filter((m) => mealGroups(m).includes(g)), o = meals.filter((m) => !mealGroups(m).includes(g));
    if (w.length >= 4 && o.length >= 4) groups.push({ key: g, kind: "group", withN: w.length, withShare: share(w), otherN: o.length, otherShare: share(o) });
  }
  const counts = new Map<string, { n: number; item: MealItem }>();
  for (const m of meals) for (const i of m.items) { const k = itemId(i); const c = counts.get(k); if (c) c.n++; else counts.set(k, { n: 1, item: i }); }
  const foods: MealPattern[] = [];
  for (const [k, { n, item }] of counts) {
    if (n < 4) continue;
    const w = meals.filter((m) => m.items.some((i) => itemId(i) === k)), o = meals.filter((m) => !m.items.some((i) => itemId(i) === k));
    if (o.length < 4) continue;
    foods.push({ key: k, kind: "food", foodKey: item.foodKey, customName: item.customName ?? null, withN: w.length, withShare: share(w), otherN: o.length, otherShare: share(o) });
  }
  foods.sort((a, b) => (b.withShare - b.otherShare) - (a.withShare - a.otherShare));
  return { groups, foods, meals: meals.length };
}

/** Elimination phase progress from settings: day X of Y (1-based), or null when not in that phase. */
export function eliminationProgress(phase: string | null, start: string | null, weeks: number, today = localDay()) {
  if (phase !== "elimination" || !start) return null;
  const day = daysBetween(start, today) + 1;
  return { day: Math.max(1, day), of: weeks * 7, done: day > weeks * 7 };
}
