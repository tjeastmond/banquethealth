import { Prisma } from "@prisma/client";
import { db } from "./db";
import {
  buildMealsForPatient,
  getSmartOrderFoodOptions,
  type PlannedMeal,
} from "./smartOrderMealBuilder";
import {
  getPatientMealGapsForDate,
  type PatientMealGaps,
  type ScheduledMealTime,
} from "./smartOrderPatients";
import {
  getDateBoundaries,
  getPatientCalorieRanges,
  getScheduledCaloriesForDate,
} from "./smartOrderQueries";

const MEAL_TIME_HOURS: Record<ScheduledMealTime, number> = {
  BREAKFAST: 8,
  LUNCH: 12,
  DINNER: 18,
};

export const triggerSmartOrderSystem = async (
  targetDate: Date = new Date(),
): Promise<void> => {
  const patientMealGaps = await getPatientMealGapsForDate(targetDate);

  if (patientMealGaps.length === 0) {
    return;
  }

  const patientIds = patientMealGaps.map((patient) => patient.patientId);
  const [foodOptions, calorieRanges, scheduledCaloriesByPatient] =
    await Promise.all([
      getSmartOrderFoodOptions(),
      getPatientCalorieRanges(patientIds),
      getScheduledCaloriesForDate(targetDate, patientIds),
    ]);

  const calorieRangesByPatient = new Map(
    calorieRanges.map((range) => [range.patientId, range]),
  );

  for (const patientMealGap of patientMealGaps) {
    const calorieRange = calorieRangesByPatient.get(patientMealGap.patientId);

    if (!calorieRange) {
      continue;
    }

    const plannedMeals = buildMealsForPatient(
      {
        minimumCalories: calorieRange.minimumCalories,
        maximumCalories: calorieRange.maximumCalories,
        scheduledCalories:
          scheduledCaloriesByPatient.get(patientMealGap.patientId) ?? 0,
        missingMealTimes: patientMealGap.missingMealTimes,
      },
      foodOptions,
    );

    await createMissingTrayOrders(targetDate, patientMealGap, plannedMeals);
  }
};

async function createMissingTrayOrders(
  targetDate: Date,
  patientMealGap: PatientMealGaps,
  plannedMeals: PlannedMeal[],
): Promise<void> {
  const trayOrders = plannedMeals.map((meal) => ({
    patientId: patientMealGap.patientId,
    mealTime: meal.mealTime,
    scheduledFor: getScheduledMealTime(targetDate, meal.mealTime),
    recipeIds: meal.recipes.map((recipe) => recipe.id),
  }));

  if (trayOrders.length === 0) {
    return;
  }

  await db.$transaction(
    async (tx) => {
      for (const trayOrder of trayOrders) {
        const alreadyExists = await hasExistingScheduledMeal(
          tx,
          targetDate,
          trayOrder.patientId,
          trayOrder.mealTime,
        );

        if (alreadyExists) {
          continue;
        }

        await tx.trayOrder.create({
          data: {
            patientId: trayOrder.patientId,
            mealTime: trayOrder.mealTime,
            scheduledFor: trayOrder.scheduledFor,
            recipes: {
              create: trayOrder.recipeIds.map((recipeId) => ({
                recipeId,
              })),
            },
          },
        });
      }
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

async function hasExistingScheduledMeal(
  tx: Prisma.TransactionClient,
  targetDate: Date,
  patientId: string,
  mealTime: ScheduledMealTime,
): Promise<boolean> {
  const { start, end } = getDateBoundaries(targetDate);

  const count = await tx.trayOrder.count({
    where: {
      patientId,
      mealTime,
      scheduledFor: {
        gte: start,
        lt: end,
      },
    },
  });

  return count > 0;
}

function getScheduledMealTime(
  targetDate: Date,
  mealTime: ScheduledMealTime,
): Date {
  return new Date(
    Date.UTC(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth(),
      targetDate.getUTCDate(),
      MEAL_TIME_HOURS[mealTime],
      0,
      0,
      0,
    ),
  );
}

export default triggerSmartOrderSystem;
