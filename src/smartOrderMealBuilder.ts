import type { FoodOption, FoodOptions } from "./smartOrderQueries";
import { getFoodOptions } from "./smartOrderQueries";
import { SCHEDULED_MEAL_TIMES, type ScheduledMealTime } from "./smartOrderShared";

/** Maps meal times to their available food options grouped by category. */
export type MealScopedFoodOptions = Record<ScheduledMealTime, FoodOptions>;

export interface PatientCalorieGoals {
  minimumCalories: number | null;
  maximumCalories: number | null;
}

export interface PlannedMeal {
  mealTime: ScheduledMealTime;
  recipes: FoodOption[];
  totalCalories: number;
}

export type SkippedMealReason = "max_calories_exceeded";

export type PlannedMealOutcome =
  | {
      status: "planned";
      meal: PlannedMeal;
    }
  | {
      status: "skipped";
      mealTime: ScheduledMealTime;
      reason: SkippedMealReason;
    };

export interface PatientMealPlanInput extends PatientCalorieGoals {
  scheduledCalories: number;
  missingMealTimes: ScheduledMealTime[];
}

interface MealCandidate {
  recipes: FoodOption[];
  totalCalories: number;
}

interface MealCalorieTarget {
  desiredCalories: number;
  minimumCalories: number;
  maximumCalories: number | null;
}

/**
 * Loads meal options by scheduled meal and fails fast when a meal has no eligible entrees.
 *
 * @returns {Promise<MealScopedFoodOptions>} Available smart-order recipe options grouped by meal and category.
 * @throws {Error} When any scheduled meal slot has no entree recipes.
 */
export async function getSmartOrderFoodOptions(): Promise<MealScopedFoodOptions> {
  const entries = await Promise.all(
    SCHEDULED_MEAL_TIMES.map(async (mealTime) => {
      const options = await getFoodOptions(mealTime);

      if (options.entrees.length === 0) {
        throw new Error(`Smart order requires at least one entree option for ${mealTime.toLowerCase()}`);
      }

      return [mealTime, options] as const;
    }),
  );

  return Object.fromEntries(entries) as MealScopedFoodOptions;
}

/**
 * Plans one meal per missing slot while tracking calories already scheduled for the day.
 *
 * @param input Patient calorie constraints, existing scheduled calories, and missing meal slots.
 * @param options Available recipe options grouped by category.
 * @returns {PlannedMealOutcome[]} One planning outcome per missing meal slot.
 */
export function buildMealsForPatient(input: PatientMealPlanInput, optionsByMealTime: MealScopedFoodOptions): PlannedMealOutcome[] {
  let scheduledCalories = input.scheduledCalories;
  const plannedMeals: PlannedMealOutcome[] = [];

  for (const [index, mealTime] of input.missingMealTimes.entries()) {
    const remainingMealCount = input.missingMealTimes.length - index;
    const calorieTarget = getMealCalorieTarget(
      {
        minimumCalories: input.minimumCalories,
        maximumCalories: input.maximumCalories,
      },
      scheduledCalories,
      remainingMealCount,
    );
    const meal = selectMealForTarget(mealTime, calorieTarget, optionsByMealTime[mealTime]);

    if (!meal) {
      plannedMeals.push({
        status: "skipped",
        mealTime,
        reason: "max_calories_exceeded",
      });
      continue;
    }

    scheduledCalories += meal.totalCalories;
    plannedMeals.push({
      status: "planned",
      meal,
    });
  }

  return plannedMeals;
}

/** Splits remaining calorie goals across the remaining meals still to be planned. */
function getMealCalorieTarget(goals: PatientCalorieGoals, scheduledCalories: number, remainingMealCount: number): MealCalorieTarget {
  const remainingMinimumCalories = Math.max(0, (goals.minimumCalories ?? 0) - scheduledCalories);
  const remainingMaximumCalories = goals.maximumCalories === null ? null : Math.max(0, goals.maximumCalories - scheduledCalories);
  const minimumCalories = remainingMealCount > 0 ? Math.ceil(remainingMinimumCalories / remainingMealCount) : 0;
  const maximumCalories = remainingMaximumCalories === null || remainingMealCount === 0 ? remainingMaximumCalories : Math.floor(remainingMaximumCalories / remainingMealCount);
  const desiredCalories = maximumCalories === null ? minimumCalories : Math.min(Math.max(minimumCalories, 0), Math.max(maximumCalories, 0));

  return {
    desiredCalories,
    minimumCalories,
    maximumCalories,
  };
}

/** Picks the best available meal combination for a meal slot and calorie target. */
function selectMealForTarget(mealTime: ScheduledMealTime, target: MealCalorieTarget, options: FoodOptions): PlannedMeal | null {
  const candidates = buildMealCandidates(options).filter((candidate) => isCandidateWithinMaximum(candidate, target));
  const sortedCandidates = [...candidates].sort((left, right) => compareMealCandidates(left, right, target));
  const selectedMeal = sortedCandidates[0];

  if (!selectedMeal) {
    return null;
  }

  return {
    mealTime,
    recipes: selectedMeal.recipes,
    totalCalories: selectedMeal.totalCalories,
  };
}

/** Filters out meal combinations that would exceed the patient's remaining maximum calories. */
function isCandidateWithinMaximum(candidate: MealCandidate, target: MealCalorieTarget): boolean {
  if (target.maximumCalories === null) {
    return true;
  }

  return candidate.totalCalories <= target.maximumCalories;
}

/** Generates every entree-led meal combination with optional side and beverage add-ons. */
function buildMealCandidates(options: FoodOptions): MealCandidate[] {
  const candidates: MealCandidate[] = [];
  const optionalSides = [undefined, ...options.sides];
  const optionalBeverages = [undefined, ...options.beverages];

  for (const entree of options.entrees) {
    for (const side of optionalSides) {
      for (const beverage of optionalBeverages) {
        const recipes = [entree, side, beverage].filter((recipe): recipe is FoodOption => recipe !== undefined);

        candidates.push({
          recipes,
          totalCalories: recipes.reduce((sum, recipe) => sum + recipe.calories, 0),
        });
      }
    }
  }

  return candidates;
}

/** Sorts meal candidates by shortfall risk, target fit, then higher calories as a tiebreaker. */
function compareMealCandidates(left: MealCandidate, right: MealCandidate, target: MealCalorieTarget): number {
  const leftScore = getMealCandidateScore(left, target);
  const rightScore = getMealCandidateScore(right, target);

  if (leftScore.shortfallPenalty !== rightScore.shortfallPenalty) {
    return leftScore.shortfallPenalty - rightScore.shortfallPenalty;
  }

  if (leftScore.distanceFromDesired !== rightScore.distanceFromDesired) {
    return leftScore.distanceFromDesired - rightScore.distanceFromDesired;
  }

  if (left.totalCalories !== right.totalCalories) {
    return right.totalCalories - left.totalCalories;
  }

  return left.recipes
    .map((recipe) => recipe.name)
    .join("|")
    .localeCompare(right.recipes.map((recipe) => recipe.name).join("|"));
}

/** Computes the ranking metrics used to compare one meal candidate against the calorie target. */
function getMealCandidateScore(
  candidate: MealCandidate,
  target: MealCalorieTarget,
): {
  shortfallPenalty: number;
  distanceFromDesired: number;
} {
  const shortfallPenalty = Math.max(0, target.minimumCalories - candidate.totalCalories);

  return {
    shortfallPenalty,
    distanceFromDesired: Math.abs(candidate.totalCalories - target.desiredCalories),
  };
}
