import type { Migration } from "@/core/db/migrations";
import { seedMigration } from "@/core/diary";
import { fodmaraConfig } from "./config";

/**
 * Engine owns 10–19; Fodmara starts at 20. The food catalogue is static code (foods.ts) – only the user's own foods
 * are rows. Every table has id + updatedAt so backup merge (newest wins) works unchanged.
 */
export const fodmaraMigrations: Migration[] = [
  seedMigration(20, fodmaraConfig),
  {
    version: 21,
    name: "fodmara_custom_food",
    sql: [
      `CREATE TABLE IF NOT EXISTS customFood (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         groups TEXT,
         isHidden INTEGER NOT NULL DEFAULT 0,
         updatedAt TEXT NOT NULL
       );`,
    ],
  },
  {
    version: 22,
    name: "fodmara_meals",
    sql: [
      `CREATE TABLE IF NOT EXISTS meal (
         id TEXT PRIMARY KEY,
         at TEXT NOT NULL,
         note TEXT,
         createdAt TEXT NOT NULL,
         updatedAt TEXT NOT NULL
       );`,
      `CREATE INDEX IF NOT EXISTS idx_meal_at ON meal(at);`,
      `CREATE TABLE IF NOT EXISTS mealItem (
         id TEXT PRIMARY KEY,
         mealId TEXT NOT NULL,
         foodKey TEXT,
         customFoodId TEXT,
         updatedAt TEXT NOT NULL
       );`,
      `CREATE INDEX IF NOT EXISTS idx_mealItem_meal ON mealItem(mealId);`,
    ],
  },
  {
    version: 23,
    name: "fodmara_stool",
    sql: [
      `CREATE TABLE IF NOT EXISTS stool (
         id TEXT PRIMARY KEY,
         at TEXT NOT NULL,
         bristol INTEGER,
         urgency INTEGER NOT NULL DEFAULT 0,
         incomplete INTEGER NOT NULL DEFAULT 0,
         blood INTEGER NOT NULL DEFAULT 0,
         note TEXT,
         updatedAt TEXT NOT NULL
       );`,
      `CREATE INDEX IF NOT EXISTS idx_stool_at ON stool(at);`,
    ],
  },
  {
    version: 24,
    name: "fodmara_challenge",
    sql: [
      `CREATE TABLE IF NOT EXISTS challenge (
         id TEXT PRIMARY KEY,
         groupKey TEXT NOT NULL,
         foodKey TEXT,
         foodName TEXT,
         startDate TEXT NOT NULL,
         status TEXT NOT NULL DEFAULT 'active',
         result TEXT,
         doneDays TEXT,
         note TEXT,
         createdAt TEXT NOT NULL,
         updatedAt TEXT NOT NULL
       );`,
    ],
  },
  {
    version: 25,
    name: "fodmara_photo_and_health",
    sql: [
      // Meal photo: a file in the app's Data directory (meals/<id>.jpg), never in the JSON backup.
      `ALTER TABLE meal ADD COLUMN photoPath TEXT;`,
      // Apple Health mirror for toilet visits (diarrhoea / constipation samples), same idempotent scheme as episodes.
      `ALTER TABLE stool ADD COLUMN healthUuid TEXT;`,
      `ALTER TABLE stool ADD COLUMN healthSyncedAt TEXT;`,
    ],
  },
];
