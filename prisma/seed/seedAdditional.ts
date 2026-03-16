import { join } from "path";
import { db } from "../../src/db";
import { additionalTables } from "./additionalConfig";
import { seedTablesFromDirectory } from "./seed";

export async function seedAdditionalPatients(): Promise<void> {
  await seedTablesFromDirectory(join(__dirname, "additionalRawData"), additionalTables);
}

if (require.main === module) {
  seedAdditionalPatients()
    .then(async () => {
      await db.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await db.$disconnect();
      process.exit(1);
    });
}
