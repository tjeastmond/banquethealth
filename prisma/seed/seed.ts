import { join } from "path";
import { db } from "../../src/db";
import { tables } from "./config";
import { parseCsv } from "./utils/parse";
import { getColumnTypes, seedManualTable } from "./utils/db";

export async function seedDatabase() {
  for (const tableName of tables) {
    const filePath = join(__dirname, "rawData", `./${tableName}.csv`);
    const columnTypes = await getColumnTypes(tableName);
    const rawData = await parseCsv(filePath, columnTypes);
    if (rawData.length === 0) {
      continue;
    }
    await seedManualTable({
      data: rawData,
      tableName,
    });
  }
}

if (require.main === module) {
  seedDatabase()
    .then(async () => {
      await db.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await db.$disconnect();
      process.exit(1);
    });
}
