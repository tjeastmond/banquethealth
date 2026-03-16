import { MealTime, Prisma } from "@prisma/client";
import { db } from "./db";

export interface FoodOption {
  id: string;
  name: string;
  calories: number;
}

export interface FoodOptions {
  entrees: FoodOption[];
  sides: FoodOption[];
  beverages: FoodOption[];
}

export interface TrayOrderWithRecipes {
  id: string;
  mealTime: MealTime;
  scheduledFor: Date;
  patientId: string;
  recipes: { recipeId: string; calories: number }[];
}

export interface PatientCalorieRange {
  patientId: string;
  minimumCalories: number | null;
  maximumCalories: number | null;
}

export interface PatientMissingMeal {
  patientId: string;
  patientName: string;
  missingMealTime: MealTime;
}

export interface PatientScheduledCalories {
  patientId: string;
  scheduledCalories: number;
}

/** Meal times the smart order system is responsible for scheduling. */
export const SCHEDULED_MEAL_TIMES = [MealTime.BREAKFAST, MealTime.LUNCH, MealTime.DINNER] as const;

const FOOD_CATEGORIES = ["Entrees", "Sides", "Beverages"] as const;

type FoodCategory = (typeof FOOD_CATEGORIES)[number];

interface RecipeRow extends FoodOption {
  category: FoodCategory;
}

function isFoodCategory(category: string): category is FoodCategory {
  return FOOD_CATEGORIES.includes(category as FoodCategory);
}

/**
 * Date boundaries for a smart-order run: `scheduled_for` is within [start, end)
 * when the run targets a given calendar day. Uses UTC day boundaries.
 */
export function getDateBoundaries(targetDate: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/**
 * Returns one row per missing scheduled meal slot for the target day.
 * The dataset is already narrowed to patients with fewer than three scheduled meals.
 */
export async function getPatientsMissingMealsForDate(targetDate: Date): Promise<PatientMissingMeal[]> {
  const { start, end } = getDateBoundaries(targetDate);

  return db.$queryRaw<PatientMissingMeal[]>`
    WITH scheduled_meal_counts AS (
      SELECT
        patient_id,
        COUNT(DISTINCT meal_time)::int AS scheduled_meal_count
      FROM tray_orders
      WHERE scheduled_for >= ${start}
        AND scheduled_for < ${end}
        AND meal_time IN (${Prisma.join(SCHEDULED_MEAL_TIMES)})
      GROUP BY patient_id
    ),
    required_meals AS (
      SELECT meal_time
      FROM (
        VALUES
          (${MealTime.BREAKFAST}::"MealTime"),
          (${MealTime.LUNCH}::"MealTime"),
          (${MealTime.DINNER}::"MealTime")
      ) AS required(meal_time)
    )
    SELECT
      p.id AS "patientId",
      p.name AS "patientName",
      rm.meal_time AS "missingMealTime"
    FROM patients p
    CROSS JOIN required_meals rm
    LEFT JOIN scheduled_meal_counts smc
      ON smc.patient_id = p.id
    WHERE COALESCE(smc.scheduled_meal_count, 0) < 3
      AND NOT EXISTS (
        SELECT 1
        FROM tray_orders t
        WHERE t.patient_id = p.id
          AND t.scheduled_for >= ${start}
          AND t.scheduled_for < ${end}
          AND t.meal_time = rm.meal_time
      )
    ORDER BY p.name, rm.meal_time
  `;
}

/** Select recipes by category: Entrees, Sides, Beverages. */
export async function getFoodOptions(): Promise<FoodOptions> {
  const rows = await db.recipe.findMany({
    where: {
      category: {
        in: [...FOOD_CATEGORIES],
      },
    },
    select: {
      id: true,
      name: true,
      calories: true,
      category: true,
    },
    orderBy: [{ category: "asc" }, { calories: "desc" }, { name: "asc" }],
  });
  const recipeRows: RecipeRow[] = rows.filter((row): row is RecipeRow => isFoodCategory(row.category));

  return {
    entrees: recipeRows.filter((row) => row.category === "Entrees").map(({ category: _category, ...recipe }) => recipe),
    sides: recipeRows.filter((row) => row.category === "Sides").map(({ category: _category, ...recipe }) => recipe),
    beverages: recipeRows.filter((row) => row.category === "Beverages").map(({ category: _category, ...recipe }) => recipe),
  };
}

/**
 * Returns existing breakfast/lunch/dinner tray orders for the target day,
 * including the recipe calorie payload needed for meal sizing.
 */
export async function getExistingTrayOrdersForDate(targetDate: Date, patientIds?: string[]): Promise<TrayOrderWithRecipes[]> {
  const { start, end } = getDateBoundaries(targetDate);
  const rows = await db.trayOrder.findMany({
    where: {
      scheduledFor: {
        gte: start,
        lt: end,
      },
      mealTime: {
        in: [...SCHEDULED_MEAL_TIMES],
      },
      ...(patientIds?.length
        ? {
            patientId: {
              in: patientIds,
            },
          }
        : {}),
    },
    select: {
      id: true,
      mealTime: true,
      scheduledFor: true,
      patientId: true,
      recipes: {
        select: {
          recipe: {
            select: {
              id: true,
              calories: true,
            },
          },
        },
      },
    },
    orderBy: [{ patientId: "asc" }, { scheduledFor: "asc" }, { mealTime: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    mealTime: row.mealTime,
    scheduledFor: row.scheduledFor,
    patientId: row.patientId,
    recipes: row.recipes.map(({ recipe }) => ({
      recipeId: recipe.id,
      calories: recipe.calories,
    })),
  }));
}

/**
 * Returns all calories already scheduled for the target day, including snacks.
 * This is the dataset the meal-builder should use to size any missing tray.
 */
export async function getScheduledCaloriesForDate(targetDate: Date, patientIds: string[]): Promise<Map<string, number>> {
  if (patientIds.length === 0) {
    return new Map();
  }

  const { start, end } = getDateBoundaries(targetDate);

  const rows = await db.patient.findMany({
    where: {
      id: {
        in: patientIds,
      },
    },
    select: {
      id: true,
      trayOrders: {
        where: {
          scheduledFor: {
            gte: start,
            lt: end,
          },
        },
        select: {
          recipes: {
            select: {
              recipe: {
                select: {
                  calories: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  });

  return new Map(
    rows.map((row) => [
      row.id,
      row.trayOrders.reduce(
        (patientTotal, trayOrder) => patientTotal + trayOrder.recipes.reduce((mealTotal, trayOrderRecipe) => mealTotal + trayOrderRecipe.recipe.calories, 0),
        0,
      ),
    ]),
  );
}

/** Fetch each patient's calorie range from active patient_diet_orders + diet_orders. */
export async function getPatientCalorieRanges(patientIds: string[]): Promise<PatientCalorieRange[]> {
  if (patientIds.length === 0) {
    return [];
  }

  const rows = await db.patient.findMany({
    where: {
      id: {
        in: patientIds,
      },
    },
    select: {
      id: true,
      patientDietOrders: {
        select: {
          dietOrder: {
            select: {
              id: true,
              isActive: true,
              minimumCalories: true,
              maximumCalories: true,
            },
          },
        },
        orderBy: {
          dietOrderId: "asc",
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  });

  const byPatient = new Map<string, PatientCalorieRange>();

  for (const patientId of patientIds) {
    byPatient.set(patientId, {
      patientId,
      minimumCalories: null,
      maximumCalories: null,
    });
  }

  for (const row of rows) {
    const existing = byPatient.get(row.id);

    if (!existing || existing.minimumCalories !== null || existing.maximumCalories !== null) {
      continue;
    }

    const activeDietOrder = row.patientDietOrders
      .map((patientDietOrder) => patientDietOrder.dietOrder)
      .find((dietOrder) => dietOrder.isActive && (dietOrder.minimumCalories !== null || dietOrder.maximumCalories !== null));

    if (!activeDietOrder) {
      continue;
    }

    byPatient.set(row.id, {
      patientId: row.id,
      minimumCalories: activeDietOrder.minimumCalories,
      maximumCalories: activeDietOrder.maximumCalories,
    });
  }

  return patientIds.map((patientId) => byPatient.get(patientId)!);
}
