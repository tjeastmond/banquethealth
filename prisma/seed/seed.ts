import { join } from "path";
import { db } from "../../src/db";
import { tables } from "./config";
import { parseCsv } from "./utils/parse";
import { getColumnTypes, seedManualTable } from "./utils/db";

export async function seedTablesFromDirectory(dataDirectory: string, tableNames: readonly string[]): Promise<void> {
  for (const tableName of tableNames) {
    const filePath = join(dataDirectory, `${tableName}.csv`);
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

export async function seedDatabase() {
  await seedTablesFromDirectory(join(__dirname, "rawData"), tables);
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
