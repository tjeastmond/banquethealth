import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { getConntionString } from "../prisma/utils";
import { dbName, runCommand, seedDataDir } from "./utils";

const adminConnectionString = getConntionString("postgres");
const adapter = new PrismaPg({ connectionString: adminConnectionString });
const db = new PrismaClient({ adapter });

const resetDb = async () => {
  await db.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await db.$executeRawUnsafe(`CREATE DATABASE ${dbName}`);
};

const resetDbFromSnapshot = async () => {
  await resetDb();
  await runCommand(
    `docker run -e PGPASSWORD=local -v "${seedDataDir}:/tmp" --network host postgres:16 pg_restore --host=127.0.0.1 -p 5442 --disable-triggers --dbname=${dbName} --username=postgres /tmp/snapshot.sql`,
  );
};

resetDbFromSnapshot()
  .then(() => {
    console.log("Database initialized successfully");
  })
  .catch((err) => {
    console.error(err);
  });
