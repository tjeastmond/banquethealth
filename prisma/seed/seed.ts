import { join } from "path";
import { db } from "../../src/db";
import { tables } from "./config";
import { parseCsv } from "./utils/parse";
import { getColumnTypes, seedManualTable } from "./utils/db";

type SeedRow = Record<string, unknown>;

const columnTypesCache = new Map<string, Promise<Record<string, string>>>();
const seedDataCache = new Map<string, Promise<SeedRow[]>>();

const getCachedColumnTypes = (tableName: string) => {
  const cached = columnTypesCache.get(tableName);
  if (cached) {
    return cached;
  }

  const next = getColumnTypes(tableName);
  columnTypesCache.set(tableName, next);
  return next;
};

const getCachedSeedData = (tableName: string) => {
  const cached = seedDataCache.get(tableName);
  if (cached) {
    return cached;
  }

  const next = (async () => {
    const filePath = join(__dirname, "rawData", `./${tableName}.csv`);
    const columnTypes = await getCachedColumnTypes(tableName);
    return parseCsv(filePath, columnTypes);
  })();

  seedDataCache.set(tableName, next);
  return next;
};

export async function seedDatabase() {
  for (const tableName of tables) {
    const rawData = await getCachedSeedData(tableName);
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
