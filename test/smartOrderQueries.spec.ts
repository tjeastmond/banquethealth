import { MealTime } from "@prisma/client";
import { db } from "../src/db";
import { getDateBoundaries } from "../src/smartOrderShared";
import { getExistingTrayOrdersForDate, getFoodOptions, getPatientCalorieRanges, getPatientsMissingMealsForDate, getScheduledCaloriesForDate } from "../src/smartOrderQueries";

const TARGET_DATE = new Date("2025-08-24T00:00:00.000Z");
const PATIENT_ID = "7ea4e6ec-f359-485b-ac99-e0b44c3e18b9";
const BOB_PATIENT_ID = "18ed16cd-39ee-4b41-92f1-460719c21dbc";
const LOW_CALORIE_DIET_ID = "f5f6e246-0cf6-4eb6-a6f1-fcb894c888ce";

describe("smartOrderQueries", () => {
  it("builds UTC day boundaries", () => {
    const { start, end } = getDateBoundaries(new Date("2025-08-24T15:42:11.000Z"));

    expect(start.toISOString()).toBe("2025-08-24T00:00:00.000Z");
    expect(end.toISOString()).toBe("2025-08-25T00:00:00.000Z");
  });

  it("returns the exact missing scheduled meal slots for the day", async () => {
    const missingMeals = await getPatientsMissingMealsForDate(TARGET_DATE);

    expect(missingMeals).toEqual([
      {
        patientId: BOB_PATIENT_ID,
        patientName: "Bob Belcher",
        missingMealTime: MealTime.BREAKFAST,
      },
      {
        patientId: BOB_PATIENT_ID,
        patientName: "Bob Belcher",
        missingMealTime: MealTime.LUNCH,
      },
      {
        patientId: "9aeabca1-b55d-49db-b406-7d252d262a57",
        patientName: "Gene Belcher",
        missingMealTime: MealTime.DINNER,
      },
      {
        patientId: "5d70767f-c7fe-44a2-a1ea-baa8dfbd2140",
        patientName: "Linda Belcher",
        missingMealTime: MealTime.BREAKFAST,
      },
      {
        patientId: "5d70767f-c7fe-44a2-a1ea-baa8dfbd2140",
        patientName: "Linda Belcher",
        missingMealTime: MealTime.LUNCH,
      },
      {
        patientId: "3590aaf3-9521-4986-84cb-a33ba42bd76e",
        patientName: "Louise Belcher",
        missingMealTime: MealTime.BREAKFAST,
      },
      {
        patientId: "3590aaf3-9521-4986-84cb-a33ba42bd76e",
        patientName: "Louise Belcher",
        missingMealTime: MealTime.DINNER,
      },
      {
        patientId: PATIENT_ID,
        patientName: "Mark Corrigan",
        missingMealTime: MealTime.DINNER,
      },
    ]);
  });

  it("returns no missing meals once breakfast lunch and dinner are all scheduled", async () => {
    await db.trayOrder.create({
      data: {
        id: "e19526f4-efcf-4a0f-8297-0ad867f5e30f",
        patientId: PATIENT_ID,
        mealTime: MealTime.DINNER,
        scheduledFor: new Date("2025-08-24T18:00:00.000Z"),
      },
    });

    const missingMeals = await getPatientsMissingMealsForDate(TARGET_DATE);

    expect(missingMeals).toEqual([
      {
        patientId: BOB_PATIENT_ID,
        patientName: "Bob Belcher",
        missingMealTime: MealTime.BREAKFAST,
      },
      {
        patientId: BOB_PATIENT_ID,
        patientName: "Bob Belcher",
        missingMealTime: MealTime.LUNCH,
      },
      {
        patientId: "9aeabca1-b55d-49db-b406-7d252d262a57",
        patientName: "Gene Belcher",
        missingMealTime: MealTime.DINNER,
      },
      {
        patientId: "5d70767f-c7fe-44a2-a1ea-baa8dfbd2140",
        patientName: "Linda Belcher",
        missingMealTime: MealTime.BREAKFAST,
      },
      {
        patientId: "5d70767f-c7fe-44a2-a1ea-baa8dfbd2140",
        patientName: "Linda Belcher",
        missingMealTime: MealTime.LUNCH,
      },
      {
        patientId: "3590aaf3-9521-4986-84cb-a33ba42bd76e",
        patientName: "Louise Belcher",
        missingMealTime: MealTime.BREAKFAST,
      },
      {
        patientId: "3590aaf3-9521-4986-84cb-a33ba42bd76e",
        patientName: "Louise Belcher",
        missingMealTime: MealTime.DINNER,
      },
    ]);
  });

  it("returns existing scheduled breakfast lunch and dinner orders with recipe calories", async () => {
    await db.trayOrder.create({
      data: {
        id: "01be0cf1-87cb-4d32-9784-4177b4b1207e",
        patientId: PATIENT_ID,
        mealTime: MealTime.DINNER,
        scheduledFor: new Date("2025-08-24T18:00:00.000Z"),
        recipes: {
          create: [
            {
              id: "65b7612c-2f52-42e3-bc65-1a72fd2d2ff4",
              recipeId: "385079f9-d049-48e2-9093-5bdcf328282f",
            },
            {
              id: "67e17093-3039-4853-ad42-a3f72d3d2851",
              recipeId: "59f4f0b4-2075-40a4-b95b-883433eed1a2",
            },
          ],
        },
      },
    });

    const orders = await getExistingTrayOrdersForDate(TARGET_DATE, [PATIENT_ID]);

    expect(orders).toHaveLength(3);
    expect(orders.map((order) => order.mealTime)).toEqual([MealTime.BREAKFAST, MealTime.LUNCH, MealTime.DINNER]);
    expect(orders[0]?.recipes).toEqual([
      { recipeId: "15c8ac77-128e-4825-960e-eb5638376e00", calories: 350 },
      { recipeId: "9e329204-a9d3-445b-ad6d-5eeb6456af66", calories: 150 },
    ]);
    expect(orders[2]?.recipes).toEqual([
      { recipeId: "385079f9-d049-48e2-9093-5bdcf328282f", calories: 450 },
      { recipeId: "59f4f0b4-2075-40a4-b95b-883433eed1a2", calories: 200 },
    ]);
  });

  it("totals all scheduled calories for the day including snacks", async () => {
    await db.trayOrder.create({
      data: {
        id: "d2be6891-2234-49b4-8208-40d3374f2ef4",
        patientId: PATIENT_ID,
        mealTime: MealTime.SNACK,
        scheduledFor: new Date("2025-08-24T15:00:00.000Z"),
        recipes: {
          create: [
            {
              id: "63cefd0c-f72e-4a48-9f5b-7e75cb32ba73",
              recipeId: "6bad53cc-89fa-403b-844a-70926fa9b00f",
            },
          ],
        },
      },
    });

    const caloriesByPatient = await getScheduledCaloriesForDate(TARGET_DATE, [PATIENT_ID]);

    expect(caloriesByPatient.get(PATIENT_ID)).toBe(1200);
  });

  it("returns each patient's calorie range when there is a single diet order", async () => {
    const calorieRanges = await getPatientCalorieRanges([PATIENT_ID]);

    expect(calorieRanges).toEqual([
      {
        patientId: PATIENT_ID,
        minimumCalories: 1500,
        maximumCalories: 2500,
      },
    ]);
  });

  it("enforces one diet plan per patient at the database level", async () => {
    await expect(
      db.patientDietOrder.create({
        data: {
          id: "50838a6f-0f1d-4879-a333-2aa27a0ee92d",
          patientId: PATIENT_ID,
          dietOrderId: LOW_CALORIE_DIET_ID,
        },
      }),
    ).rejects.toThrow(/Unique constraint failed/);
  });

  it("returns only breakfast-eligible food options for breakfast", async () => {
    const options = await getFoodOptions(MealTime.BREAKFAST);

    expect(options.entrees.length).toBeGreaterThan(0);
    expect(options.entrees.some((recipe) => recipe.name === "Pancakes")).toBe(true);
    expect(options.entrees.some((recipe) => recipe.name === "Bacon")).toBe(true);
    expect(options.entrees.some((recipe) => recipe.name === "Salmon")).toBe(false);
    expect(options.entrees.every((recipe) => recipe.name !== "Chocolate Pudding")).toBe(true);
    expect(options.beverages.some((recipe) => recipe.name === "Water")).toBe(true);
  });

  it("returns only dinner-eligible food options for dinner", async () => {
    const options = await getFoodOptions(MealTime.DINNER);

    expect(options.entrees.some((recipe) => recipe.name === "Salmon")).toBe(true);
    expect(options.entrees.some((recipe) => recipe.name === "Pancakes")).toBe(false);
    expect(options.sides.some((recipe) => recipe.name === "Mashed Potatoes")).toBe(true);
    expect(options.beverages.some((recipe) => recipe.name === "Chocolate Ensure")).toBe(true);
  });
});
