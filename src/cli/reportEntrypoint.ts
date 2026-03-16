import { db } from "../db";
import { getPatientTrayOrderReport, renderPatientTrayOrderReport } from "./trayOrderReport";

const DEFAULT_SERVICE_DATE = "2025-08-24";

async function main(): Promise<void> {
  const targetDate = parseServiceDate(process.argv[2] ?? DEFAULT_SERVICE_DATE);
  const report = await getPatientTrayOrderReport(targetDate);

  console.log(renderPatientTrayOrderReport(report, targetDate));
}

function parseServiceDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid service date: ${value}. Expected YYYY-MM-DD.`);
  }

  return parsed;
}

main()
  .catch((error: Error) => {
    console.error("Something went wrong");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
