import { MealTime } from "@prisma/client";
import { db } from "../src/db";
import { getPatientTrayOrderReport, renderPatientTrayOrderReport } from "../src/cli/trayOrderReport";

const TARGET_DATE = new Date("2025-08-24T00:00:00.000Z");

describe("trayOrderReport", () => {
  it("returns all seeded patients for the target date", async () => {
    const report = await getPatientTrayOrderReport(TARGET_DATE);

    expect(report.map((row) => row.patientName)).toEqual(["Bob Belcher", "Calvin Fischoeder", "Mark Corrigan"]);
  });

  it("returns the expected meal coverage while ignoring snacks", async () => {
    const report = await getPatientTrayOrderReport(TARGET_DATE);

    expect(report).toEqual([
      {
        patientId: "18ed16cd-39ee-4b41-92f1-460719c21dbc",
        patientName: "Bob Belcher",
        meals: {
          DINNER: {
            mealTime: MealTime.DINNER,
            recipeNames: ["Salmon", "Mixed Veggies"],
            totalCalories: 650,
          },
        },
      },
      {
        patientId: "3534c978-ef72-4927-bf4c-a8f83ec2062c",
        patientName: "Calvin Fischoeder",
        meals: {
          BREAKFAST: {
            mealTime: MealTime.BREAKFAST,
            recipeNames: ["Pancakes", "Hash Browns"],
            totalCalories: 500,
          },
          LUNCH: {
            mealTime: MealTime.LUNCH,
            recipeNames: ["Turkey Sandwich"],
            totalCalories: 500,
          },
          DINNER: {
            mealTime: MealTime.DINNER,
            recipeNames: ["Salmon", "Mashed Potatoes"],
            totalCalories: 600,
          },
        },
      },
      {
        patientId: "7ea4e6ec-f359-485b-ac99-e0b44c3e18b9",
        patientName: "Mark Corrigan",
        meals: {
          BREAKFAST: {
            mealTime: MealTime.BREAKFAST,
            recipeNames: ["Pancakes", "Hash Browns"],
            totalCalories: 500,
          },
          LUNCH: {
            mealTime: MealTime.LUNCH,
            recipeNames: ["Turkey Sandwich"],
            totalCalories: 500,
          },
        },
      },
    ]);
  });

  it("renders an ascii table with meal details and missing labels", async () => {
    const report = await getPatientTrayOrderReport(TARGET_DATE);

    const rendered = renderPatientTrayOrderReport(report, TARGET_DATE);

    expect(rendered).toContain("Tray Orders for 2025-08-24");
    expect(rendered).toContain("+");
    expect(rendered).toContain("Patient");
    expect(rendered).toContain("Breakfast");
    expect(rendered).toContain("Lunch");
    expect(rendered).toContain("Dinner");
    expect(rendered).toContain("Missing");
    expect(rendered).toContain("Salmon, Mixed Veggies (650 cal)");
    expect(rendered).toContain("Patients: 3 | Missing meal coverage: 2");
  });

  it("does not treat snacks as meal coverage", async () => {
    const report = await getPatientTrayOrderReport(TARGET_DATE);
    const bob = report.find((row) => row.patientName === "Bob Belcher");

    expect(bob?.meals.BREAKFAST).toBeUndefined();
    expect(bob?.meals.LUNCH).toBeUndefined();
    expect(bob?.meals.DINNER).toBeDefined();

    const snackOrders = await db.trayOrder.findMany({
      where: {
        patientId: "18ed16cd-39ee-4b41-92f1-460719c21dbc",
        mealTime: MealTime.SNACK,
      },
    });

    expect(snackOrders).toHaveLength(1);
  });
});
