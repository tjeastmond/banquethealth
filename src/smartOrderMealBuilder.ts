import type { FoodOption, FoodOptions } from "./smartOrderQueries";
import { getFoodOptions } from "./smartOrderQueries";
import type { ScheduledMealTime } from "./smartOrderPatients";

export interface PatientCalorieGoals {
  minimumCalories: number | null;
  maximumCalories: number | null;
}

export interface PlannedMeal {
  mealTime: ScheduledMealTime;
  recipes: FoodOption[];
  totalCalories: number;
}

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

export async function getSmartOrderFoodOptions(): Promise<FoodOptions> {
  const options = await getFoodOptions();

  if (options.entrees.length === 0 || options.sides.length === 0 || options.beverages.length === 0) {
    throw new Error("Smart order requires entree, side, and beverage options");
  }

  return options;
}

export function buildMealsForPatient(input: PatientMealPlanInput, options: FoodOptions): PlannedMeal[] {
  let scheduledCalories = input.scheduledCalories;
  const plannedMeals: PlannedMeal[] = [];

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
    const meal = selectMealForTarget(mealTime, calorieTarget, options);

    if (!meal) {
      continue;
    }

    scheduledCalories += meal.totalCalories;
    plannedMeals.push(meal);
  }

  return plannedMeals;
}

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

function isCandidateWithinMaximum(candidate: MealCandidate, target: MealCalorieTarget): boolean {
  if (target.maximumCalories === null) {
    return true;
  }

  return candidate.totalCalories <= target.maximumCalories;
}

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
