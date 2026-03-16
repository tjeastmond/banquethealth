import { dbName, runCommand, seedDataDir } from "./utils"

const saveDbSnapshot = async () => {
    await runCommand(
        `npx prisma migrate reset --force`
    )
    await runCommand(
        `npx prisma db seed`
    )
    await runCommand(
        `docker run -e PGPASSWORD=local -e TZ=America/New_York -v "${seedDataDir}:/tmp" --network host postgres:16 pg_dump --host=127.0.0.1 -p 5442 --dbname=${dbName} --username=postgres --file=/tmp/snapshot.sql --format=t`
      )
}

saveDbSnapshot()
    .catch((err) => {
        console.error(err)
    })
