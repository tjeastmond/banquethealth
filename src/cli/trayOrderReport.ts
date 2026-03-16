import { db } from "../db";
import { getPatientCalorieRanges, getScheduledCaloriesForDate } from "../smartOrderQueries";
import { getDateBoundaries, SCHEDULED_MEAL_TIMES, type NamedPatient, type PatientCalorieGoals, type ScheduledMealTime } from "../smartOrderShared";

export interface ReportMeal {
  mealTime: ScheduledMealTime;
  recipeNames: string[];
  totalCalories: number;
}

export interface PatientTrayOrderReportRow extends NamedPatient, PatientCalorieGoals {
  meals: Partial<Record<ScheduledMealTime, ReportMeal>>;
  dietPlanName: string | null;
  totalPlannedCalories: number;
}

const MEAL_TIME_LABELS: Record<ScheduledMealTime, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
};

const ANSI = {
  reset: "\u001b[0m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  bold: "\u001b[1m",
} as const;

/**
 * Returns one report row per patient for the target service date.
 */
export async function getPatientTrayOrderReport(targetDate: Date): Promise<PatientTrayOrderReportRow[]> {
  const { start, end } = getDateBoundaries(targetDate);
  const patients = await db.patient.findMany({
    select: {
      id: true,
      name: true,
      patientDietOrders: {
        select: {
          dietOrder: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          dietOrderId: "asc",
        },
      },
      trayOrders: {
        where: {
          scheduledFor: {
            gte: start,
            lt: end,
          },
          mealTime: {
            in: [...SCHEDULED_MEAL_TIMES],
          },
        },
        select: {
          mealTime: true,
          recipes: {
            select: {
              recipe: {
                select: {
                  name: true,
                  calories: true,
                },
              },
            },
          },
        },
        orderBy: [{ scheduledFor: "asc" }, { id: "asc" }],
      },
    },
    orderBy: {
      name: "asc",
    },
  });
  const patientIds = patients.map((patient) => patient.id);
  const [calorieRanges, scheduledCaloriesByPatient] = await Promise.all([getPatientCalorieRanges(patientIds), getScheduledCaloriesForDate(targetDate, patientIds)]);
  const calorieRangeByPatient = new Map(calorieRanges.map((range) => [range.patientId, range]));

  return patients.map((patient) => {
    const meals: PatientTrayOrderReportRow["meals"] = {};

    for (const trayOrder of patient.trayOrders) {
      const mealTime = trayOrder.mealTime as ReportMeal["mealTime"];

      if (meals[mealTime]) {
        throw new Error(`Patient ${patient.name} (${patient.id}) has duplicate ${mealTime.toLowerCase()} tray orders on ${formatServiceDate(targetDate)}.`);
      }

      meals[mealTime] = {
        mealTime,
        recipeNames: trayOrder.recipes.map((trayOrderRecipe) => trayOrderRecipe.recipe.name),
        totalCalories: trayOrder.recipes.reduce((total, trayOrderRecipe) => total + trayOrderRecipe.recipe.calories, 0),
      };
    }

    const calorieRange = calorieRangeByPatient.get(patient.id);

    return {
      patientId: patient.id,
      patientName: patient.name,
      meals,
      dietPlanName: patient.patientDietOrders[0]?.dietOrder.name ?? null,
      minimumCalories: calorieRange?.minimumCalories ?? null,
      maximumCalories: calorieRange?.maximumCalories ?? null,
      totalPlannedCalories: scheduledCaloriesByPatient.get(patient.id) ?? 0,
    };
  });
}

/**
 * Renders a simple ANSI-colored ASCII table for a day's tray orders.
 */
export function renderPatientTrayOrderReport(rows: PatientTrayOrderReportRow[], targetDate: Date): string {
  const headers = ["Patient", ...SCHEDULED_MEAL_TIMES.map((mealTime) => MEAL_TIME_LABELS[mealTime]), "Diet Plan", "Min Calories", "Max Calories", "Planned Calories"];
  const tableRows = rows.map((row) => {
    const hasMissingMeal = SCHEDULED_MEAL_TIMES.some((mealTime) => !row.meals[mealTime]);

    return {
      hasMissingMeal,
      columns: [
        colorize(row.patientName, hasMissingMeal ? ANSI.yellow : ANSI.bold),
        ...SCHEDULED_MEAL_TIMES.map((mealTime) => formatMealCell(row.meals[mealTime])),
        row.dietPlanName ?? "-",
        formatCalorieLimitCell(row.minimumCalories),
        formatCalorieLimitCell(row.maximumCalories),
        colorize(`${row.totalPlannedCalories} cal`, ANSI.bold),
      ],
    };
  });

  const widths = headers.map((header, index) => Math.max(visibleLength(header), ...tableRows.map((row) => visibleLength(row.columns[index] ?? ""))));

  const separator = buildSeparator(widths);
  const summaryCount = tableRows.filter((row) => row.hasMissingMeal).length;
  const lines = [
    `${ANSI.bold}Tray Orders for ${formatServiceDate(targetDate)}${ANSI.reset}`,
    separator,
    buildRow(headers, widths),
    separator,
    ...tableRows.map((row) => buildRow(row.columns, widths)),
    separator,
    `Patients: ${rows.length} | Missing meal coverage: ${summaryCount}`,
  ];

  return lines.join("\n");
}

function formatMealCell(meal: ReportMeal | undefined): string {
  if (!meal) {
    return colorize("Missing", ANSI.red);
  }

  const details = meal.recipeNames.length > 0 ? meal.recipeNames.join(", ") : "Ordered";
  return colorize(`${details} (${meal.totalCalories} cal)`, ANSI.green);
}

function formatCalorieLimitCell(calories: number | null): string {
  return calories === null ? "-" : `${calories} cal`;
}

function buildSeparator(widths: number[]): string {
  return `+${widths.map((width) => "-".repeat(width + 2)).join("+")}+`;
}

function buildRow(columns: string[], widths: number[]): string {
  return `| ${columns.map((column, index) => `${column}${" ".repeat(Math.max(widths[index] - visibleLength(column), 0))}`).join(" | ")} |`;
}

function formatServiceDate(targetDate: Date): string {
  return targetDate.toISOString().slice(0, 10);
}

function colorize(value: string, color: string): string {
  return `${color}${value}${ANSI.reset}`;
}

function visibleLength(value: string): number {
  return value.replace(/\u001b\[[0-9;]*m/g, "").length;
}
