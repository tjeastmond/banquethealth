import { MealTime } from "@prisma/client";
import { db } from "../src/db";
import { triggerSmartOrderSystem } from "../src/smartOrder";

const TARGET_DATE = new Date("2025-08-24T00:00:00.000Z");
const EXISTING_PATIENT_ID = "7ea4e6ec-f359-485b-ac99-e0b44c3e18b9";
const REGULAR_DIET_ID = "aa2453c7-f6d2-4719-8719-bf74bf98896b";

describe("triggerSmartOrderSystem", () => {
  it("creates breakfast lunch and dinner for a patient missing all scheduled meals", async () => {
    const patientId = "c66bca0e-f915-4d92-a66c-6366bd34bf18";

    await createPatientWithDiet(patientId, "Jeremy Usborne");

    await triggerSmartOrderSystem(TARGET_DATE);

    const trayOrders = await db.trayOrder.findMany({
      where: {
        patientId,
      },
      include: {
        recipes: true,
      },
      orderBy: {
        scheduledFor: "asc",
      },
    });

    expect(trayOrders).toHaveLength(3);
    expect(trayOrders.map((order) => order.mealTime)).toEqual([
      MealTime.BREAKFAST,
      MealTime.LUNCH,
      MealTime.DINNER,
    ]);
    expect(trayOrders.every((order) => order.mealTime !== MealTime.SNACK)).toBe(
      true
    );
    expect(trayOrders.every((order) => order.recipes.length > 0)).toBe(true);
  });

  it("does not duplicate meals that are already scheduled", async () => {
    await triggerSmartOrderSystem(TARGET_DATE);

    const trayOrders = await db.trayOrder.findMany({
      where: {
        patientId: EXISTING_PATIENT_ID,
        scheduledFor: {
          gte: TARGET_DATE,
          lt: new Date("2025-08-25T00:00:00.000Z"),
        },
      },
      orderBy: {
        scheduledFor: "asc",
      },
    });

    expect(trayOrders).toHaveLength(3);
    expect(trayOrders.filter((order) => order.mealTime === MealTime.BREAKFAST)).toHaveLength(1);
    expect(trayOrders.filter((order) => order.mealTime === MealTime.LUNCH)).toHaveLength(1);
    expect(trayOrders.filter((order) => order.mealTime === MealTime.DINNER)).toHaveLength(1);
  });

  it("accounts for earlier scheduled calories when constructing a missing meal", async () => {
    await triggerSmartOrderSystem(TARGET_DATE);

    const dinnerOrder = await db.trayOrder.findFirst({
      where: {
        patientId: EXISTING_PATIENT_ID,
        mealTime: MealTime.DINNER,
        scheduledFor: {
          gte: TARGET_DATE,
          lt: new Date("2025-08-25T00:00:00.000Z"),
        },
      },
      include: {
        recipes: {
          include: {
            recipe: true,
          },
        },
      },
    });

    expect(dinnerOrder).not.toBeNull();
    expect(
      dinnerOrder!.recipes.reduce(
        (sum, trayOrderRecipe) => sum + trayOrderRecipe.recipe.calories,
        0
      )
    ).toBe(500);
  });

  it("is idempotent across reruns", async () => {
    await triggerSmartOrderSystem(TARGET_DATE);
    await triggerSmartOrderSystem(TARGET_DATE);

    const trayOrders = await db.trayOrder.findMany({
      where: {
        patientId: EXISTING_PATIENT_ID,
        scheduledFor: {
          gte: TARGET_DATE,
          lt: new Date("2025-08-25T00:00:00.000Z"),
        },
      },
    });

    expect(trayOrders).toHaveLength(3);
  });

  it("never creates a meal that would push total daily calories above the maximum", async () => {
    const patientId = "0f4ceba0-1e5f-4c7a-94af-b9f8a9b809d0";
    const dietOrderId = "17571665-4fa7-407a-ad6e-c264c3ed6b87";

    await db.dietOrder.create({
      data: {
        id: dietOrderId,
        name: "Strict Max",
        minimumCalories: 1200,
        maximumCalories: 1400,
      },
    });

    await createPatientWithSpecificDiet(
      patientId,
      "Super Hans",
      dietOrderId
    );

    await db.trayOrder.create({
      data: {
        id: "c49e9d2d-841d-45aa-a630-1a6aa3ef3980",
        patientId,
        mealTime: MealTime.BREAKFAST,
        scheduledFor: new Date("2025-08-24T08:00:00.000Z"),
        recipes: {
          create: [
            {
              id: "2b8045f8-936f-4fc8-9616-5b411f18f2d6",
              recipeId: "3080a02c-d6a9-4634-8878-711920f11a66",
            },
          ],
        },
      },
    });

    await db.trayOrder.create({
      data: {
        id: "8c9cbb97-09d8-470f-89c5-8f6431f4bcbf",
        patientId,
        mealTime: MealTime.LUNCH,
        scheduledFor: new Date("2025-08-24T12:00:00.000Z"),
        recipes: {
          create: [
            {
              id: "4d12f765-5fd5-4d33-abfa-1ee37bfdf7ae",
              recipeId: "89f0fc07-045e-425c-aeef-f092562fc8c9",
            },
          ],
        },
      },
    });

    await db.trayOrder.create({
      data: {
        id: "55f01dc7-4857-4ca4-a143-843a11fb91fd",
        patientId,
        mealTime: MealTime.SNACK,
        scheduledFor: new Date("2025-08-24T15:00:00.000Z"),
        recipes: {
          create: [
            {
              id: "75600b5d-e547-4477-a25d-b5912cdb5f56",
              recipeId: "6bad53cc-89fa-403b-844a-70926fa9b00f",
            },
          ],
        },
      },
    });

    await triggerSmartOrderSystem(TARGET_DATE);

    const dinnerOrder = await db.trayOrder.findFirst({
      where: {
        patientId,
        mealTime: MealTime.DINNER,
        scheduledFor: {
          gte: TARGET_DATE,
          lt: new Date("2025-08-25T00:00:00.000Z"),
        },
      },
    });

    const allRecipes = await db.trayOrderRecipe.findMany({
      where: {
        trayOrder: {
          patientId,
          scheduledFor: {
            gte: TARGET_DATE,
            lt: new Date("2025-08-25T00:00:00.000Z"),
          },
        },
      },
      include: {
        recipe: true,
      },
    });

    const totalCalories = allRecipes.reduce(
      (sum, trayOrderRecipe) => sum + trayOrderRecipe.recipe.calories,
      0
    );

    expect(dinnerOrder).toBeNull();
    expect(totalCalories).toBe(1200);
  });
});

async function createPatientWithDiet(
  patientId: string,
  name: string
): Promise<void> {
  await createPatientWithSpecificDiet(patientId, name, REGULAR_DIET_ID);
}

async function createPatientWithSpecificDiet(
  patientId: string,
  name: string,
  dietOrderId: string
): Promise<void> {
  await db.patient.create({
    data: {
      id: patientId,
      name,
      patientDietOrders: {
        create: [
          {
            id: "4220c7e2-4f71-4bce-8902-bd3c417f58df",
            dietOrderId,
          },
        ],
      },
    },
  });
}
