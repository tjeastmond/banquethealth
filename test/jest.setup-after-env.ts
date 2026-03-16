import { runCommand } from "../scripts/utils"
import { db } from "../src/db"
beforeEach(async () => {
  await runCommand('npm run reset-db')
})

afterEach(async () => {
  // Disconnect from the database
  await db.$disconnect()
})
