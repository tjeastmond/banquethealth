import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL environment variable");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const db = new PrismaClient({ adapter });
