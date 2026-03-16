import { MealTime } from "@prisma/client";
import { db } from "../src/db";
import { getPatientTrayOrderReport, renderPatientTrayOrderReport } from "../src/cli/trayOrderReport";

const TARGET_DATE = new Date("2025-08-24T00:00:00.000Z");

describe("trayOrderReport", () => {
  it("returns all seeded patients for the target date", async () => {
    const report = await getPatientTrayOrderReport(TARGET_DATE);

    expect(report.map((row) => row.patientName)).toEqual([
      "Bob Belcher",
      "Calvin Fischoeder",
      "Gene Belcher",
      "Linda Belcher",
      "Louise Belcher",
      "Mark Corrigan",
    ]);
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
        patientId: "9aeabca1-b55d-49db-b406-7d252d262a57",
        patientName: "Gene Belcher",
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
      {
        patientId: "5d70767f-c7fe-44a2-a1ea-baa8dfbd2140",
        patientName: "Linda Belcher",
        meals: {
          DINNER: {
            mealTime: MealTime.DINNER,
            recipeNames: ["Salmon", "Mashed Potatoes"],
            totalCalories: 600,
          },
        },
      },
      {
        patientId: "3590aaf3-9521-4986-84cb-a33ba42bd76e",
        patientName: "Louise Belcher",
        meals: {
          LUNCH: {
            mealTime: MealTime.LUNCH,
            recipeNames: ["Turkey Sandwich"],
            totalCalories: 500,
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
    expect(rendered).toContain("Patients: 6 | Missing meal coverage: 5");
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

  it("fails fast when a patient has duplicate scheduled meal coverage", async () => {
    await db.trayOrder.create({
      data: {
        id: "0a747d6f-0f95-455c-8489-a85f73e8e87d",
        patientId: "7ea4e6ec-f359-485b-ac99-e0b44c3e18b9",
        mealTime: MealTime.BREAKFAST,
        scheduledFor: new Date("2025-08-24T09:00:00.000Z"),
      },
    });

    await expect(getPatientTrayOrderReport(TARGET_DATE)).rejects.toThrow(
      "Patient Mark Corrigan (7ea4e6ec-f359-485b-ac99-e0b44c3e18b9) has duplicate breakfast tray orders on 2025-08-24.",
    );
  });
});
