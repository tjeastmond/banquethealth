import { MealTime } from "@prisma/client";
import { getPatientsMissingMealsForDate, type PatientMissingMeal, SCHEDULED_MEAL_TIMES } from "./smartOrderQueries";

export type ScheduledMealTime = (typeof SCHEDULED_MEAL_TIMES)[number];

export interface PatientMealGaps {
  patientId: string;
  patientName: string;
  missingMealTimes: ScheduledMealTime[];
}

const SCHEDULED_MEAL_ORDER: ReadonlyMap<ScheduledMealTime, number> = new Map(SCHEDULED_MEAL_TIMES.map((mealTime, index) => [mealTime, index]));

export function isScheduledMealTime(mealTime: MealTime): mealTime is ScheduledMealTime {
  return SCHEDULED_MEAL_TIMES.includes(mealTime as ScheduledMealTime);
}

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

export async function getPatientMealGapsForDate(targetDate: Date): Promise<PatientMealGaps[]> {
  const missingMeals = await getPatientsMissingMealsForDate(targetDate);
  return groupMissingMealsByPatient(missingMeals);
}
