import type { DiaryConfig } from "@/core/diary";
import { ibsTagGroups } from "./tagsets";

/**
 * IBS has good and bad days rather than discrete attacks, so the daily check-in carries the main number
 * (overall gut symptoms 0–10, 0 = none). Episodes are "flare-ups" logged with "My gut is acting up".
 * Meals and toilet visits are separate tables (migrations 22–23); no medication-day thresholds.
 */
export const fodmaraConfig: DiaryConfig = {
  slug: "fodmara",
  episodeKind: "flare",
  tagGroups: ibsTagGroups,
  checkinFields: [
    { key: "gut", kind: "scale", min: 0, max: 10 },
    { key: "bloating", kind: "scale", max: 5 },
    { key: "pain", kind: "scale", max: 5 },
    { key: "sleep", kind: "scale", max: 5 },
    { key: "stress", kind: "scale", max: 5 },
  ],
  medicationDayThresholds: [],
  freeHistoryDays: 90,
};

/** Small 1–5 scales under the gut picker (the gut number itself has its own big control). */
export const sideFields = ["bloating", "pain", "sleep", "stress"] as const;

/** Gut score → the engine's day status (calendar tint and the "hard day" count). */
export const statusFor = (gut: number) => (gut <= 3 ? "none" : gut <= 6 ? "mild" : "attack") as "none" | "mild" | "attack";

/** Contrasts the insights look for: sleep last night and stress the same day. */
export const contrastFields = [
  { key: "sleep", lag: 0 as const },
  { key: "stress", lag: 0 as const },
];
