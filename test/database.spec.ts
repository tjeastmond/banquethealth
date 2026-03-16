import { db } from "../src/db";

describe("database reset", () => {
  it("loads database url from environment", () => {
    expect(process.env.DATABASE_URL).toBeDefined();
  });

  it("loads the seed data for each test", async () => {
    const trayOrderRecipes = await db.trayOrderRecipe.findMany();
    expect(trayOrderRecipes.length).toBe(3);

    await db.trayOrderRecipe.deleteMany();

    const trayOrderRecipesAfter = await db.trayOrderRecipe.findMany();
    expect(trayOrderRecipesAfter.length).toBe(0);
  });

  it("resets the seed data before the next test", async () => {
    const trayOrderRecipes = await db.trayOrderRecipe.findMany();
    expect(trayOrderRecipes.length).toBe(3);
  });
});
