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

interface TrayOrderRecipeRow {
  recipeId: string;
  calories: number;
}

interface TrayOrderWithRecipesRow {
  id: string;
  mealTime: MealTime;
  scheduledFor: Date;
  patientId: string;
  recipes: TrayOrderRecipeRow[] | null;
}

interface PatientDietOrderRow {
  patientId: string;
  minimumCalories: number | null;
  maximumCalories: number | null;
}

/** Meal times the smart order system is responsible for scheduling. */
export const SCHEDULED_MEAL_TIMES = [MealTime.BREAKFAST, MealTime.LUNCH, MealTime.DINNER] as const;

const FOOD_CATEGORIES = ["Entrees", "Sides", "Beverages"] as const;

type FoodCategory = (typeof FOOD_CATEGORIES)[number];

interface RecipeRow extends FoodOption {
  category: FoodCategory;
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
  const rows = await db.$queryRaw<RecipeRow[]>`
    SELECT
      id,
      name,
      calories,
      category
    FROM recipes
    WHERE category IN (${Prisma.join(FOOD_CATEGORIES)})
    ORDER BY category, calories DESC, name ASC
  `;

  return {
    entrees: rows.filter((row) => row.category === "Entrees").map(({ category: _category, ...recipe }) => recipe),
    sides: rows.filter((row) => row.category === "Sides").map(({ category: _category, ...recipe }) => recipe),
    beverages: rows.filter((row) => row.category === "Beverages").map(({ category: _category, ...recipe }) => recipe),
  };
}

/**
 * Returns existing breakfast/lunch/dinner tray orders for the target day,
 * including the recipe calorie payload needed for meal sizing.
 */
export async function getExistingTrayOrdersForDate(targetDate: Date, patientIds?: string[]): Promise<TrayOrderWithRecipes[]> {
  const { start, end } = getDateBoundaries(targetDate);
  const patientFilter = patientIds?.length ? Prisma.sql`AND t.patient_id IN (${Prisma.join(patientIds)})` : Prisma.empty;

  const rows = await db.$queryRaw<TrayOrderWithRecipesRow[]>(Prisma.sql`
    SELECT
      t.id,
      t.meal_time AS "mealTime",
      t.scheduled_for AS "scheduledFor",
      t.patient_id AS "patientId",
      COALESCE(
        json_agg(
          json_build_object(
            'recipeId', r.id,
            'calories', r.calories
          )
        ) FILTER (WHERE r.id IS NOT NULL),
        '[]'::json
      ) AS recipes
    FROM tray_orders t
    LEFT JOIN tray_order_recipes tor
      ON tor.tray_order_id = t.id
    LEFT JOIN recipes r
      ON r.id = tor.recipe_id
    WHERE t.scheduled_for >= ${start}
      AND t.scheduled_for < ${end}
      AND t.meal_time IN (${Prisma.join(SCHEDULED_MEAL_TIMES)})
      ${patientFilter}
    GROUP BY t.id, t.meal_time, t.scheduled_for, t.patient_id
    ORDER BY t.patient_id, t.scheduled_for, t.meal_time
  `);

  return rows.map((row) => ({
    id: row.id,
    mealTime: row.mealTime,
    scheduledFor: row.scheduledFor,
    patientId: row.patientId,
    recipes: row.recipes ?? [],
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

  const rows = await db.$queryRaw<PatientScheduledCalories[]>`
    SELECT
      p.id AS "patientId",
      COALESCE(SUM(r.calories), 0)::int AS "scheduledCalories"
    FROM patients p
    LEFT JOIN tray_orders t
      ON t.patient_id = p.id
      AND t.scheduled_for >= ${start}
      AND t.scheduled_for < ${end}
    LEFT JOIN tray_order_recipes tor
      ON tor.tray_order_id = t.id
    LEFT JOIN recipes r
      ON r.id = tor.recipe_id
    WHERE p.id IN (${Prisma.join(patientIds)})
    GROUP BY p.id
  `;

  return new Map(rows.map((row) => [row.patientId, row.scheduledCalories]));
}

/** Fetch each patient's calorie range from active patient_diet_orders + diet_orders. */
export async function getPatientCalorieRanges(patientIds: string[]): Promise<PatientCalorieRange[]> {
  if (patientIds.length === 0) {
    return [];
  }

  const rows = await db.$queryRaw<PatientDietOrderRow[]>`
    SELECT
      p.id AS "patientId",
      d.minimum_calories AS "minimumCalories",
      d.maximum_calories AS "maximumCalories"
    FROM patients p
    LEFT JOIN patient_diet_orders pdo
      ON pdo.patient_id = p.id
    LEFT JOIN diet_orders d
      ON d.id = pdo.diet_order_id
      AND d.is_active = true
    WHERE p.id IN (${Prisma.join(patientIds)})
    ORDER BY p.id, d.id
  `;

  const byPatient = new Map<string, PatientCalorieRange>();

  for (const patientId of patientIds) {
    byPatient.set(patientId, {
      patientId,
      minimumCalories: null,
      maximumCalories: null,
    });
  }

  for (const row of rows) {
    if (row.minimumCalories === null && row.maximumCalories === null) {
      continue;
    }

    byPatient.set(row.patientId, {
      patientId: row.patientId,
      minimumCalories: row.minimumCalories,
      maximumCalories: row.maximumCalories,
    });
  }

  return patientIds.map((patientId) => byPatient.get(patientId)!);
}
