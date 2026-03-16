import "dotenv/config"

export const getConntionString = (databaseName: string): string => {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
        throw new Error("Missing DATABASE_URL environment variable")
    }

    const url = new URL(connectionString)
    url.pathname = `/${databaseName}`
    return url.toString()
}
