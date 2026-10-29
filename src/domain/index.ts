/**
 * Domain registry. Fodmara = the generic symptom-diary engine (src/core/diary) configured for IBS / low-FODMAP
 * (src/domain/fodmara). A sibling app (IBS, menopause) swaps only this folder.
 */
import { diaryMigrations, configureDiary } from "@/core/diary";
import { fodmaraMigrations } from "./fodmara/migrations";
import { fodmaraConfig } from "./fodmara/config";
import { FodmaraRoutes, domainTabs, type DomainTab } from "./fodmara/routes";

configureDiary(fodmaraConfig);

export const domainMigrations = [...diaryMigrations, ...fodmaraMigrations];
export const DomainRoutes = FodmaraRoutes;
export { domainTabs };
export type { DomainTab };
