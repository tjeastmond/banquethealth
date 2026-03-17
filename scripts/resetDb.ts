import { db } from "../src/db";
import { tables } from "../prisma/seed/config";
import { seedDatabase } from "../prisma/seed/seed";

export const resetDb = async () => {
  const quotedTables = tables.map((tableName) => `"${tableName}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE;`);
  await seedDatabase();
};

if (require.main === module) {
  resetDb()
    .then(() => {
      console.log("Database reset successfully");
      return db.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await db.$disconnect();
      process.exit(1);
    });
}
