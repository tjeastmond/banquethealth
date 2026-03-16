import { MealTime } from "@prisma/client";

/** Meal times the smart order system is responsible for scheduling. */
export const SCHEDULED_MEAL_TIMES = [MealTime.BREAKFAST, MealTime.LUNCH, MealTime.DINNER] as const;

/** Type alias for the meal times the smart order system is responsible for scheduling. */
export type ScheduledMealTime = (typeof SCHEDULED_MEAL_TIMES)[number];

/** Common patient identifier payload shared across smart-order modules. */
export interface PatientIdentity {
  patientId: string;
}

/** Patient identifier and display name used by smart-order workflows. */
export interface NamedPatient extends PatientIdentity {
  patientName: string;
}

/** Daily calorie constraint range for a patient. */
export interface PatientCalorieGoals {
  minimumCalories: number | null;
  maximumCalories: number | null;
}

/**
 * Computes UTC day boundaries for a smart-order run.
 *
 * `scheduled_for` is considered part of the target day when it falls within `[start, end)`.
 *
 * @param targetDate Day being evaluated.
 * @returns {{ start: Date; end: Date }} Inclusive start and exclusive end timestamps for that UTC day.
 */
export function getDateBoundaries(targetDate: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
