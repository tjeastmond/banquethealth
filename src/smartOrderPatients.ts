import { MealTime } from "@prisma/client";
import { getPatientsMissingMealsForDate, type PatientMissingMeal, SCHEDULED_MEAL_TIMES } from "./smartOrderQueries";

export type ScheduledMealTime = (typeof SCHEDULED_MEAL_TIMES)[number];

export interface PatientMealGaps {
  patientId: string;
  patientName: string;
  missingMealTimes: ScheduledMealTime[];
}

const SCHEDULED_MEAL_ORDER: ReadonlyMap<ScheduledMealTime, number> = new Map(SCHEDULED_MEAL_TIMES.map((mealTime, index) => [mealTime, index]));

/**
 * Narrows a meal time to the breakfast/lunch/dinner set handled by smart ordering.
 *
 * @param mealTime Meal time value to validate.
 * @returns {mealTime is ScheduledMealTime} True when the meal time is one the smart ordering workflow schedules.
 */
export function isScheduledMealTime(mealTime: MealTime): mealTime is ScheduledMealTime {
  return SCHEDULED_MEAL_TIMES.includes(mealTime as ScheduledMealTime);
}

/**
 * Groups missing meal rows by patient and sorts each patient's missing meals in service order.
 *
 * @param missingMeals Flat list of missing meal rows for a target day.
 * @returns {PatientMealGaps[]} One entry per patient with ordered missing meal times.
 */
export function groupMissingMealsByPatient(missingMeals: PatientMissingMeal[]): PatientMealGaps[] {
  const grouped = new Map<string, PatientMealGaps>();

  for (const missingMeal of missingMeals) {
    if (!isScheduledMealTime(missingMeal.missingMealTime)) {
      continue;
    }

    const existing = grouped.get(missingMeal.patientId);

    if (existing) {
      existing.missingMealTimes.push(missingMeal.missingMealTime);
      continue;
    }

    grouped.set(missingMeal.patientId, {
      patientId: missingMeal.patientId,
      patientName: missingMeal.patientName,
      missingMealTimes: [missingMeal.missingMealTime],
    });
  }

  return Array.from(grouped.values())
    .map((patient) => ({
      ...patient,
      missingMealTimes: patient.missingMealTimes.sort(
        (left, right) => (SCHEDULED_MEAL_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) - (SCHEDULED_MEAL_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER),
      ),
    }))
    .sort((left, right) => left.patientName.localeCompare(right.patientName));
}

/**
 * Fetches and groups each patient's missing breakfast, lunch, and dinner slots for a day.
 *
 * @param targetDate Day to inspect using UTC date boundaries.
 * @returns {Promise<PatientMealGaps[]>} Patients who are missing one or more scheduled meals on that day.
 */
export async function getPatientMealGapsForDate(targetDate: Date): Promise<PatientMealGaps[]> {
  const missingMeals = await getPatientsMissingMealsForDate(targetDate);
  return groupMissingMealsByPatient(missingMeals);
}
