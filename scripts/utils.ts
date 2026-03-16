import { exec } from "child_process"
import { join } from "path"

export const seedDataDir = join(__dirname, '../prisma/seed/rawData')

export const dbName = 'dev'

export const runCommand = (
    command: string,
    options = {
      maxBuffer: 1024 * 10000, // https://stackoverflow.com/a/65248598
    }
  ) => {
    return new Promise((resolve, reject) => {
      exec(command, options, (err, stdout) => {
        if (err) {
          reject(err)
          return
        }
        resolve(stdout)
      })
    })
}
