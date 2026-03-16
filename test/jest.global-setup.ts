import { runCommand } from "../scripts/utils"

export default async () => {
  await runCommand('npm run save-db')
}
