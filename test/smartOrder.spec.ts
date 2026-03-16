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

    const summary = await triggerSmartOrderSystem(TARGET_DATE);

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
    expect(trayOrders.map((order) => order.mealTime)).toEqual([MealTime.BREAKFAST, MealTime.LUNCH, MealTime.DINNER]);
    expect(trayOrders.every((order) => order.mealTime !== MealTime.SNACK)).toBe(true);
    expect(trayOrders.every((order) => order.recipes.length > 0)).toBe(true);
    expect(summary.mealsCreated).toBe(6);
    expect(summary.mealsSkipped).toBe(0);
  });

  it("does not duplicate meals that are already scheduled", async () => {
    const summary = await triggerSmartOrderSystem(TARGET_DATE);

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
    expect(summary.patientResults.some((patient) => patient.patientId === EXISTING_PATIENT_ID)).toBe(true);
  });

  it("accounts for earlier scheduled calories when constructing a missing meal", async () => {
    const summary = await triggerSmartOrderSystem(TARGET_DATE);

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
    expect(dinnerOrder!.recipes.reduce((sum, trayOrderRecipe) => sum + trayOrderRecipe.recipe.calories, 0)).toBe(500);
    expect(summary.mealsSkipped).toBe(0);
  });

  it("is idempotent across reruns", async () => {
    const firstRun = await triggerSmartOrderSystem(TARGET_DATE);
    const secondRun = await triggerSmartOrderSystem(TARGET_DATE);

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
    expect(firstRun.mealsCreated).toBeGreaterThan(0);
    expect(secondRun.mealsCreated).toBe(0);
    expect(secondRun.mealsSkipped).toBe(0);
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

    await createPatientWithSpecificDiet(patientId, "Super Hans", dietOrderId);

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

    const summary = await triggerSmartOrderSystem(TARGET_DATE);

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

    const totalCalories = allRecipes.reduce((sum, trayOrderRecipe) => sum + trayOrderRecipe.recipe.calories, 0);

    expect(dinnerOrder).toBeNull();
    expect(totalCalories).toBe(1200);
    expect(summary.mealsSkipped).toBe(1);
    expect(summary.skippedByReason.max_calories_exceeded).toBe(1);
    expect(summary.patientResults).toContainEqual({
      patientId,
      patientName: "Super Hans",
      outcomes: [{ status: "skipped", mealTime: MealTime.DINNER, reason: "max_calories_exceeded" }],
    });
  });

  it("creates later compliant meals even when an earlier missing meal must be skipped for max calories", async () => {
    const patientId = "e9de2bd0-6322-42dc-b310-b22d0fa6127d";
    const dietOrderId = "4ce5301d-d656-4a79-a851-11d40e08c237";

    await db.dietOrder.create({
      data: {
        id: dietOrderId,
        name: "Tight Split Max",
        minimumCalories: 0,
        maximumCalories: 1350,
      },
    });

    await createPatientWithSpecificDiet(patientId, "Hans Gruber", dietOrderId);

    await db.trayOrder.create({
      data: {
        id: "33ee45cb-3380-4ffd-85e5-870d4be4eab6",
        patientId,
        mealTime: MealTime.BREAKFAST,
        scheduledFor: new Date("2025-08-24T08:00:00.000Z"),
        recipes: {
          create: [
            {
              id: "6a1363b6-a258-4ef7-9cd2-3634c5db3697",
              recipeId: "3080a02c-d6a9-4634-8878-711920f11a66",
            },
            {
              id: "d2f27fc4-d6c4-48dd-a74a-8ead900cf4fe",
              recipeId: "59f4f0b4-2075-40a4-b95b-883433eed1a2",
            },
            {
              id: "c376955f-0d45-41e0-85ca-7783a8f54773",
              recipeId: "6bad53cc-89fa-403b-844a-70926fa9b00f",
            },
          ],
        },
      },
    });

    const summary = await triggerSmartOrderSystem(TARGET_DATE);

    const trayOrders = await db.trayOrder.findMany({
      where: {
        patientId,
        scheduledFor: {
          gte: TARGET_DATE,
          lt: new Date("2025-08-25T00:00:00.000Z"),
        },
      },
      orderBy: {
        scheduledFor: "asc",
      },
    });

    expect(trayOrders.map((order) => order.mealTime)).toEqual([MealTime.BREAKFAST, MealTime.DINNER]);
    const patientResult = summary.patientResults.find((patient) => patient.patientId === patientId);

    expect(patientResult).toBeDefined();
    expect(patientResult!.patientName).toBe("Hans Gruber");
    expect(patientResult!.outcomes).toHaveLength(2);
    expect(patientResult!.outcomes[0]).toEqual({ status: "skipped", mealTime: MealTime.LUNCH, reason: "max_calories_exceeded" });
    expect(patientResult!.outcomes[1].status).toBe("planned");

    if (patientResult!.outcomes[1].status !== "planned") {
      throw new Error("expected dinner to be planned");
    }

    expect(patientResult!.outcomes[1].meal.mealTime).toBe(MealTime.DINNER);
    expect(patientResult!.outcomes[1].meal.totalCalories).toBeLessThanOrEqual(450);
  });
});

async function createPatientWithDiet(patientId: string, name: string): Promise<void> {
  await createPatientWithSpecificDiet(patientId, name, REGULAR_DIET_ID);
}

async function createPatientWithSpecificDiet(patientId: string, name: string, dietOrderId: string): Promise<void> {
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
