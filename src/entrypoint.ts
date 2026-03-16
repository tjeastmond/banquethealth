import { db } from "./db";
import triggerSmartOrderSystem from "./smartOrder";

const DEFAULT_SERVICE_DATE = new Date(Date.UTC(2025, 7, 24));

void triggerSmartOrderSystem(DEFAULT_SERVICE_DATE)
  .then((summary) => {
    const { patientResults: _patientResults, ...loggableSummary } = summary;
    console.log("\nDone:", loggableSummary);
  })
  .catch((error: Error) => {
    process.exitCode = 1;
    console.error("Something went wrong");
    console.error(error);
  })
  .finally(async () => {
    await db.$disconnect();
  });
