/** The six FODMAP groups (fructans and GOS are oligosaccharides; sorbitol and mannitol are the polyols). Stable keys. */
export const GROUPS = ["fructan", "gos", "lactose", "fructose", "sorbitol", "mannitol"] as const;
export type FodmapGroup = (typeof GROUPS)[number];
export type FoodCat = "veg" | "fruit" | "grain" | "dairy" | "protein" | "legume" | "nut" | "drink" | "other";
export const CATS: FoodCat[] = ["veg", "fruit", "grain", "dairy", "protein", "legume", "nut", "drink", "other"];

/**
 * Common test foods per group for the reintroduction phase – the classic examples dietitians use. Keys point into the
 * food catalogue. Portions are deliberately not given in grams: the plan is small → medium → large, agreed with the dietitian.
 */
export const TEST_FOODS: Record<FodmapGroup, string[]> = {
  fructan: ["wheat_bread", "garlic", "onion", "wheat_pasta"],
  gos: ["chickpeas", "lentils", "kidney_beans"],
  lactose: ["milk", "yogurt"],
  fructose: ["honey", "mango", "asparagus"],
  sorbitol: ["avocado", "blackberries", "apricot"],
  mannitol: ["mushrooms", "cauliflower", "sweet_potato"],
};

/** A reintroduction test: 3 test days (small, medium, large), then 3 washout days back on the elimination diet. */
export const TEST_DAYS = 3;
export const WASHOUT_DAYS = 3;
