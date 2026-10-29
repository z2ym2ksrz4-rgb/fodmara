import { getDb, persist, newId } from "@/core/db";
import { listTags, addMedication, setEpisodeTags, logIntake, setCheckin } from "@/core/diary";
import { localDay } from "@/core/ui";
import { useSettings } from "@/core/settings";
import { statusFor } from "./config";
import { FOOD_BY_KEY } from "./foods";

/**
 * Demo data for screenshots and smoke tests (dev builds only; wired to window.__seedDemo in main.tsx).
 * Deterministic: 100 days, three meals a day. Meals with onion/garlic or wheat are followed by more flare-ups,
 * bad nights and stress nudge the gut score up, the elimination phase (days 70–43) calms things down.
 * Reintroduction so far: lactose tolerated, fructans reacted, GOS test running (day 2 today).
 */
const NOTES: Record<string, [string, string, string, string]> = {
  en: ["After pasta with garlic last night", "Glass of milk fine", "Bloated on day 2", "Half an avocado OK"],
  da: ["Efter pasta med hvidløg i går aftes", "Et glas mælk gik fint", "Oppustet på dag 2", "En halv avocado gik fint"],
  de: ["Nach Pasta mit Knoblauch gestern Abend", "Ein Glas Milch war okay", "Blähbauch an Tag 2", "Eine halbe Avocado ging"],
  sv: ["Efter pasta med vitlök i går kväll", "Ett glas mjölk gick bra", "Uppblåst dag 2", "En halv avokado gick bra"],
  nb: ["Etter pasta med hvitløk i går kveld", "Et glass melk gikk fint", "Oppblåst på dag 2", "En halv avokado gikk fint"],
};

export async function seedDemo() {
  const db = getDb();
  const notes = NOTES[useSettings.getState().language] ?? NOTES.en;
  await db.execute(`DELETE FROM episodeTag; DELETE FROM medicationIntake; DELETE FROM episode; DELETE FROM medication; DELETE FROM dailyCheckin; DELETE FROM report;
    DELETE FROM meal; DELETE FROM mealItem; DELETE FROM stool; DELETE FROM challenge; DELETE FROM customFood;`);
  const tags = await listTags();
  const byKey = (g: string, k: string) => tags.find((t) => t.groupKey === g && t.key === k)!.id;
  const med = await addMedication("Loperamide", "acute");
  await addMedication("Peppermint oil capsules", "preventive");

  const now = new Date();
  const at = (daysAgo: number, h: number, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, h, m).toISOString();
  const elim = (d: number) => d <= 70 && d >= 43; // strict elimination 4 weeks
  // menus: [breakfast, lunch, dinner]; trigger-heavy before elimination, mild during, mixed after
  const before = [["oats", "milk", "banana_ripe"], ["wheat_bread", "hard_cheese", "apple"], ["wheat_pasta", "onion", "garlic", "beef", "tomato"]];
  const before2 = [["wheat_cereal", "yogurt"], ["rye_bread", "eggs", "cucumber"], ["rice", "chicken", "onion", "mushrooms"]];
  const during = [["oats", "lactose_free_milk", "blueberries"], ["gluten_free_bread", "eggs", "spinach"], ["rice", "fish", "carrot", "potato", "garlic_oil"]];
  const during2 = [["corn_tortilla", "eggs", "bell_pepper"], ["rice_noodles", "tofu", "spring_onion_green"], ["potato", "chicken", "green_beans", "olive_oil"]];
  const after = [["oats", "milk", "strawberries"], ["gluten_free_bread", "hard_cheese", "tomato"], ["rice", "beef", "carrot", "garlic_oil"]];
  const after2 = [["yogurt", "kiwi"], ["spelt_sourdough", "eggs", "lettuce"], ["quinoa", "fish", "zucchini", "onion"]];
  const flareDays: number[] = [];

  for (let d = 100; d >= 0; d--) {
    const menus = elim(d) ? (d % 2 ? during : during2) : d > 70 ? (d % 2 ? before : before2) : (d % 2 ? after : after2);
    const times = [[7, 30], [12, 15], [18, 45]];
    let fructanDinner = false;
    for (let i = 0; i < 3; i++) {
      if (d === 0 && i > 0) continue; // today: breakfast only
      const id = newId(); const t = at(d, times[i]![0]!, times[i]![1]!);
      await db.run(`INSERT INTO meal(id,at,note,createdAt,updatedAt) VALUES(?,?,?,?,?)`, [id, t, null, t, t], false);
      for (const k of menus[i]!) await db.run(`INSERT INTO mealItem(id,mealId,foodKey,customFoodId,updatedAt) VALUES(?,?,?,?,?)`, [newId(), id, k, null, t], false);
      if (i === 2 && menus[i]!.some((k) => FOOD_BY_KEY.get(k)?.groups.includes("fructan"))) fructanDinner = true;
    }
    if (d === 0) continue;
    const sleep = [4, 3, 4, 2, 4, 5, 3][d % 7]!, stress = [2, 3, 2, 4, 3, 1, 2][d % 7]!;
    const flare = fructanDinner && (d % 3 !== 0) && d > 1; // flare-up the next morning after most onion/garlic/wheat dinners
    if (flare) flareDays.push(d - 1);
    const base = d > 70 ? 5 : elim(d) ? 2 : 3;
    if (d % 11 === 6) continue; // a few missed check-ins, like real life
    const gut = Math.max(0, Math.min(10, Math.round(base + (sleep <= 2 ? 2 : 0) + (stress >= 4 ? 1 : 0) + (flareDays.includes(d) ? 3 : 0))));
    await setCheckin(localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - d)), statusFor(gut),
      { gut, bloating: Math.max(1, Math.min(5, Math.round(gut / 2))), pain: Math.max(1, Math.min(5, Math.round(gut / 2.5))), sleep, stress });
  }

  for (const [i, d] of flareDays.filter((x) => x >= 1).entries()) {
    const start = new Date(at(d, [8, 10, 7, 9][i % 4]!, 20)); const end = new Date(start.getTime() + [3, 5, 2, 6][i % 4]! * 36e5);
    const id = newId();
    await db.run(`INSERT INTO episode(id,kind,startedAt,endedAt,intensity,note,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?)`,
      [id, "flare", start.toISOString(), end.toISOString(), [7, 6, 8, 7][i % 4], i === 0 ? notes[0] : null, start.toISOString(), end.toISOString()], false);
    const sym = [["bloating", "cramps"], ["pain", "gas"], ["bloating", "diarrhoea", "urgency"], ["cramps", "rumbling"]][i % 4]!;
    const trig = [["meal", "large_meal"], ["stress"], ["eating_out", "meal"], ["poor_sleep"]][i % 4]!;
    await setEpisodeTags(id, [...sym.map((k) => byKey("symptom", k)), ...trig.map((k) => byKey("trigger", k)), byKey("location", i % 2 ? "lower" : "all_over"), byKey("relief", i % 2 ? "heat_pad" : "peppermint_tea")]);
    if (sym.includes("diarrhoea")) await logIntake(med, id, new Date(start.getTime() + 40 * 6e4).toISOString());
  }

  for (let d = 100; d >= 1; d--) {
    const flare = flareDays.includes(d);
    const visits = flare ? 3 : d % 4 === 0 ? 2 : 1;
    for (let v = 0; v < visits; v++) {
      const bristol = flare ? [6, 6, 5][v]! : d > 70 ? [5, 4, 6, 4][d % 4]! : [4, 4, 3, 4, 5][d % 5]!;
      const t = at(d, [8, 13, 20][v]!, 5);
      await db.run(`INSERT INTO stool(id,at,bristol,urgency,incomplete,blood,note,updatedAt) VALUES(?,?,?,?,?,?,?,?)`, [newId(), t, bristol, flare && v === 0 ? 1 : 0, d % 9 === 0 ? 1 : 0, 0, null, t], false);
    }
  }

  const ch = async (group: string, food: string, startAgo: number, status: string, result: string | null, done: boolean[], note: string | null) => {
    const start = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - startAgo)); const t = at(startAgo, 9);
    await db.run(`INSERT INTO challenge(id,groupKey,foodKey,foodName,startDate,status,result,doneDays,note,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      [newId(), group, food, null, start, status, result, JSON.stringify(done), note, t, t], false);
  };
  await ch("lactose", "milk", 40, "done", "tolerated", [true, true, true], notes[1]);
  await ch("fructan", "wheat_bread", 32, "done", "reaction", [true, true, false], notes[2]);
  await ch("sorbitol", "avocado", 24, "done", "some", [true, true, true], notes[3]);
  await ch("mannitol", "mushrooms", 15, "done", "tolerated", [true, true, true], null);
  await ch("gos", "chickpeas", 1, "active", null, [true, false, false], null);

  const s = useSettings.getState();
  await s.set("fodmapPhase", "reintro");
  await s.set("phaseStart", localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 70)));
  await s.set("eliminationWeeks", 4);
  await s.set("conditionProfile", JSON.stringify({ type: "mixed", since: "1to5y", diagnosed: "yes" }));
  await persist();
}
