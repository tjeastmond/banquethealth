import { db } from "../src/db";

const SEEDED_TRAY_ORDER_RECIPE_COUNT = 17;

describe("database reset", () => {
  it("loads database url from environment", () => {
    expect(process.env.DATABASE_URL).toBeDefined();
  });

  it("loads the seed data for each test", async () => {
    const trayOrderRecipes = await db.trayOrderRecipe.findMany();
    expect(trayOrderRecipes.length).toBe(SEEDED_TRAY_ORDER_RECIPE_COUNT);

    await db.trayOrderRecipe.deleteMany();

    const trayOrderRecipesAfter = await db.trayOrderRecipe.findMany();
    expect(trayOrderRecipesAfter.length).toBe(0);
  });

  it("resets the seed data before the next test", async () => {
    const trayOrderRecipes = await db.trayOrderRecipe.findMany();
    expect(trayOrderRecipes.length).toBe(SEEDED_TRAY_ORDER_RECIPE_COUNT);
  });
});
