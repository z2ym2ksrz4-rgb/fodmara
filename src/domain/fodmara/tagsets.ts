import type { TagGroupDef } from "@/core/diary";

/**
 * IBS tag sets for a flare-up. Keys are stable identifiers (seed ids are derived from them – never rename, only add);
 * labels live in locales under diary.tags.<group>.<key>.
 */
export const ibsTagGroups: TagGroupDef[] = [
  {
    key: "symptom",
    kind: "symptom",
    tags: ["bloating", "cramps", "pain", "gas", "rumbling", "diarrhoea", "constipation", "urgency", "nausea", "heartburn", "fatigue", "headache", "anxiety"],
  },
  {
    key: "location",
    kind: "location",
    tags: ["upper", "lower", "left", "right", "all_over"],
  },
  {
    key: "trigger",
    kind: "trigger",
    tags: [
      "meal", "large_meal", "fatty_food", "spicy_food", "coffee", "alcohol", "fizzy_drink", "ate_fast", "eating_out", "skipped_meal",
      "stress", "poor_sleep", "period", "travel", "medication_change", "illness",
    ],
  },
  {
    key: "relief",
    kind: "relief",
    tags: ["heat_pad", "peppermint_tea", "walk", "lie_down", "toilet", "loose_clothes", "breathing", "relaxation", "massage", "warm_drink", "rest", "distraction"],
  },
];
