import { runCommand } from "./utils";

const resetDb = async () => {
  await runCommand("npx prisma migrate reset --force");
  await runCommand("npx prisma db seed");
};

resetDb()
  .then(() => {
    console.log("Database initialized successfully");
  })
  .catch((err) => {
    console.error(err);
  });
