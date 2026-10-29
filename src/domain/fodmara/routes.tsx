import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { startEpisode, openEpisode, endEpisode } from "@/core/diary";
import { ensurePermission } from "@/core/notifications";
import { useSettings } from "@/core/settings";
import { Home } from "./screens/Home";
import { Calendar } from "./screens/Calendar";
import { Insights } from "./screens/Insights";
import { EpisodeSheet } from "./screens/EpisodeSheet";
import { MedicationsSheet } from "./screens/Medications";
import { MealSheet } from "./screens/MealSheet";
import { StoolSheet } from "./screens/StoolSheet";
import { FoodsSheet } from "./screens/FoodsSheet";
import { Test } from "./screens/Test";
import { InfoSheets } from "./screens/InfoSheets";
import { replanReminders } from "./reminders";
import { useUi } from "./store";

export type DomainTab = "home" | "calendar" | "test" | "insights";
export const domainTabs: { key: DomainTab; labelKey: string }[] = [
  { key: "home", labelKey: "nav.home" }, { key: "calendar", labelKey: "nav.calendar" }, { key: "test", labelKey: "nav.test" }, { key: "insights", labelKey: "nav.insights" },
];

/**
 * Deep links (widget, notification tap):  fodmara://episode/new  starts a flare-up and opens the sheet,
 * fodmara://episode/open  opens the current one. Handled here so the widget can stay dumb.
 */
async function handleUrl(url: string) {
  if (url.includes("episode/new")) { const existed = await openEpisode(); const e = await startEpisode(); useUi.getState().bump(); useUi.getState().openEpisode(e.id, existed ? "full" : "quick"); }
  else if (url.includes("episode/open")) { const e = await openEpisode(); if (e) useUi.getState().openEpisode(e.id, "full"); }
}

/** Notification action buttons: "Settled" ends the open flare-up without opening the app; "Still going" just dismisses. */
async function setupNotificationActions(t: (k: string) => string) {
  if (Capacitor.getPlatform() === "web") return;
  try {
    await LocalNotifications.registerActionTypes({ types: [{ id: "OPEN_EPISODE", actions: [
      { id: "end", title: t("notif.actionEnd") },
      { id: "continue", title: t("notif.actionContinue") },
    ] }] });
    await LocalNotifications.removeAllListeners();
    await LocalNotifications.addListener("localNotificationActionPerformed", async (a) => {
      const url = (a.notification.extra as { url?: string } | undefined)?.url;
      if (a.actionId === "end") { const e = await openEpisode(); if (e) { await endEpisode(e.id); useUi.getState().bump(); } return; }
      if (a.actionId === "continue") return;
      if (url) void handleUrl(url);
    });
  } catch (e) { console.warn("[notif] actions", e); }
}

export function FodmaraRoutes({ tab }: { tab: DomainTab }) {
  const { t } = useTranslation();
  const version = useUi((s) => s.version);
  const hour = useSettings((s) => s.dailyReminderHour);
  const checkinReminder = useSettings((s) => s.checkinReminder);

  useEffect(() => {
    if (Capacitor.getPlatform() === "web") {
      if (location.hash.startsWith("#fodmara://")) void handleUrl(location.hash.slice(1));
      return;
    }
    const sub = CapApp.addListener("appUrlOpen", (e) => void handleUrl(e.url));
    void CapApp.getLaunchUrl().then((l) => { if (l?.url) void handleUrl(l.url); });
    return () => { void sub.then((h) => h.remove()); };
  }, []);
  useEffect(() => { void setupNotificationActions(t); }, [t]);
  useEffect(() => { void ensurePermission().then(() => replanReminders(t)); }, [t, version, hour, checkinReminder]);

  return (
    <>
      {tab === "home" && <Home />}
      {tab === "calendar" && <Calendar />}
      {tab === "test" && <Test />}
      {tab === "insights" && <Insights />}
      <EpisodeSheet />
      <MealSheet />
      <StoolSheet />
      <FoodsSheet />
      <MedicationsSheet />
      <InfoSheets />
    </>
  );
}
