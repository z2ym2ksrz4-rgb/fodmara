import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { TFunction } from "i18next";
import { getCheckin, openEpisode } from "@/core/diary";
import { localDay } from "@/core/ui";
import { useSettings } from "@/core/settings";
import { activeChallenge, challengeEnd } from "./data";
import { TEST_DAYS } from "./fodmap";

/**
 * Reminders, re-planned on every start:
 *  - daily check-in at the chosen hour (skipped for today if today already has a check-in),
 *  - "has it settled?" 12 h after a flare-up was opened and left open,
 *  - during a reintroduction test: the day's portion at 08:00 on the three test days, and "how did the test go?"
 *    the morning after the washout.
 * No meal or medication reminders (that would be a care plan, not a diary).
 */
export async function replanReminders(t: TFunction) {
  if (Capacitor.getPlatform() === "web") return;
  const s = useSettings.getState();
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel(pending);
  const notifs: Parameters<typeof LocalNotifications.schedule>[0]["notifications"] = [];
  const now = new Date();

  if (s.checkinReminder) {
    const todayDone = !!(await getCheckin(localDay()));
    for (let d = 0; d < 30; d++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, s.dailyReminderHour, 0, 0);
      if (at <= now || (d === 0 && todayDone)) continue;
      notifs.push({ id: 100000 + d, title: t("notif.checkinTitle"), body: t("notif.checkinBody"), schedule: { at }, smallIcon: "ic_stat_notify" });
    }
  }
  if (s.openEpisodeReminder) {
    const open = await openEpisode();
    if (open) {
      const at = new Date(new Date(open.startedAt).getTime() + 12 * 36e5);
      if (at > now) notifs.push({ id: 200001, title: t("notif.openTitle"), body: t("notif.openBody"), schedule: { at }, smallIcon: "ic_stat_notify", actionTypeId: "OPEN_EPISODE", extra: { url: "fodmara://episode/open" } });
    }
  }
  const c = await activeChallenge();
  if (c) {
    const food = c.foodKey ? t(`food.items.${c.foodKey}`) : c.foodName ?? "";
    for (let d = 0; d < TEST_DAYS; d++) {
      const at = new Date(c.startDate + "T08:00:00"); at.setDate(at.getDate() + d);
      if (at > now) notifs.push({ id: 300000 + d, title: t("notif.testTitle", { group: t(`fodmap.group.${c.groupKey}`) }), body: t("notif.testBody", { portion: t(`test.portion.${d}`), food }), schedule: { at }, smallIcon: "ic_stat_notify" });
    }
    const end = new Date(challengeEnd(c) + "T09:00:00"); end.setDate(end.getDate() + 1);
    if (end > now) notifs.push({ id: 300010, title: t("notif.resultTitle"), body: t("notif.resultBody", { food }), schedule: { at: end }, smallIcon: "ic_stat_notify" });
  }
  if (notifs.length) await LocalNotifications.schedule({ notifications: notifs });
}
