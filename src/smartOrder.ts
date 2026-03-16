import { Prisma } from "@prisma/client";
import { db } from "./db";
import { buildMealsForPatient, getSmartOrderFoodOptions, type PlannedMeal, type PlannedMealOutcome, type SkippedMealReason } from "./smartOrderMealBuilder";
import { getPatientMealGapsForDate, type PatientMealGaps, type ScheduledMealTime } from "./smartOrderPatients";
import { getDateBoundaries, getPatientCalorieRanges, getScheduledCaloriesForDate } from "./smartOrderQueries";

const MEAL_TIME_HOURS: Record<ScheduledMealTime, number> = {
  BREAKFAST: 8,
  LUNCH: 12,
  DINNER: 18,
};

export interface PatientMealResult {
  patientId: string;
  patientName: string;
  outcomes: PlannedMealOutcome[];
}

export interface SmartOrderRunSummary {
  patientsProcessed: number;
  mealsCreated: number;
  mealsSkipped: number;
  skippedByReason: Record<SkippedMealReason, number>;
  patientResults: PatientMealResult[];
}

const EMPTY_SKIPPED_BY_REASON: Record<SkippedMealReason, number> = {
  max_calories_exceeded: 0,
};

/**
 * Builds and inserts any missing scheduled tray orders for the target day.
 *
 * @param targetDate Day to process. Defaults to the current date.
 * @returns {Promise<SmartOrderRunSummary>} Summary of created and skipped smart-order outcomes.
 */
export const triggerSmartOrderSystem = async (targetDate: Date = new Date()): Promise<SmartOrderRunSummary> => {
  const patientMealGaps = await getPatientMealGapsForDate(targetDate);
  const summary = createEmptyRunSummary();

  if (patientMealGaps.length === 0) {
    logRunSummary(summary);
    return summary;
  }

  summary.patientsProcessed = patientMealGaps.length;

  const patientIds = patientMealGaps.map((patient) => patient.patientId);
  const [foodOptions, calorieRanges, scheduledCaloriesByPatient] = await Promise.all([
    getSmartOrderFoodOptions(),
    getPatientCalorieRanges(patientIds),
    getScheduledCaloriesForDate(targetDate, patientIds),
  ]);

  const calorieRangesByPatient = new Map(calorieRanges.map((range) => [range.patientId, range]));

  for (const patientMealGap of patientMealGaps) {
    const calorieRange = calorieRangesByPatient.get(patientMealGap.patientId);

    if (!calorieRange) {
      continue;
    }

    const outcomes = buildMealsForPatient(
      {
        minimumCalories: calorieRange.minimumCalories,
        maximumCalories: calorieRange.maximumCalories,
        scheduledCalories: scheduledCaloriesByPatient.get(patientMealGap.patientId) ?? 0,
        missingMealTimes: patientMealGap.missingMealTimes,
      },
      foodOptions,
    );

    summary.patientResults.push({
      patientId: patientMealGap.patientId,
      patientName: patientMealGap.patientName,
      outcomes,
    });

    for (const outcome of outcomes) {
      if (outcome.status === "skipped") {
        summary.mealsSkipped += 1;
        summary.skippedByReason[outcome.reason] += 1;
      }
    }

    summary.mealsCreated += await createMissingTrayOrders(targetDate, patientMealGap, outcomes);
  }

  logRunSummary(summary);
  return summary;
};

/** Creates planned tray orders inside a transaction while rechecking for same-day duplicates. */
async function createMissingTrayOrders(targetDate: Date, patientMealGap: PatientMealGaps, plannedMeals: PlannedMealOutcome[]): Promise<number> {
  const trayOrders = plannedMeals
    .filter((meal): meal is { status: "planned"; meal: PlannedMeal } => meal.status === "planned")
    .map(({ meal }) => ({
      patientId: patientMealGap.patientId,
      mealTime: meal.mealTime,
      scheduledFor: getScheduledMealTime(targetDate, meal.mealTime),
      recipeIds: meal.recipes.map((recipe) => recipe.id),
    }));

  if (trayOrders.length === 0) {
    return 0;
  }

  return db.$transaction(
    async (tx) => {
      let createdCount = 0;

      for (const trayOrder of trayOrders) {
        const alreadyExists = await hasExistingScheduledMeal(tx, targetDate, trayOrder.patientId, trayOrder.mealTime);

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

        createdCount += 1;
      }

      return createdCount;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

/** Checks whether the patient already has a tray order for the same meal slot on the target day. */
async function hasExistingScheduledMeal(tx: Prisma.TransactionClient, targetDate: Date, patientId: string, mealTime: ScheduledMealTime): Promise<boolean> {
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

/** Converts a target day and meal slot into the UTC timestamp used for scheduling that tray. */
function getScheduledMealTime(targetDate: Date, mealTime: ScheduledMealTime): Date {
  return new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), MEAL_TIME_HOURS[mealTime], 0, 0, 0));
}

function createEmptyRunSummary(): SmartOrderRunSummary {
  return {
    patientsProcessed: 0,
    mealsCreated: 0,
    mealsSkipped: 0,
    skippedByReason: { ...EMPTY_SKIPPED_BY_REASON },
    patientResults: [],
  };
}

function logRunSummary(summary: SmartOrderRunSummary): void {
  console.info(
    `[smart-order] patients=${summary.patientsProcessed} created=${summary.mealsCreated} skipped=${summary.mealsSkipped} max_calories_exceeded=${summary.skippedByReason.max_calories_exceeded}`,
  );
}

export default triggerSmartOrderSystem;
