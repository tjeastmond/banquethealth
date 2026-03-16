import { db } from "../src/db";

describe("example tests", () => {
  it("loads database url from environment", () => {
    expect(process.env.DATABASE_URL).toBeDefined();
  });

  it("tests utilize the seed data too", async () => {
    const trayOrderRecipes = await db.trayOrderRecipe.findMany();
    expect(trayOrderRecipes.length).toBe(3);
    await db.trayOrderRecipe.deleteMany();
    const trayOrderRecipesAfter = await db.trayOrderRecipe.findMany();
    expect(trayOrderRecipesAfter.length).toBe(0);
  });

  it("the seed data is reset before each test", async () => {
    const trayOrderRecipes = await db.trayOrderRecipe.findMany();
    expect(trayOrderRecipes.length).toBe(3);
  });
});
