import { PrismaClient } from '@prisma/client'
import { db } from '../../../src/db'

export const seedManualTable = async ({
    _db = db,
    data,
    tableName,
  }: {
    _db?: PrismaClient
    data: any[]
    tableName: string
  }) => {
    const columns = Object.keys(data[0])
  
    const values = data.map((row) => {
      return `(${columns
        .map((column) => {
          const value = row[column]
          if (value === null || value === undefined) {
            return 'NULL'
          }
          return `'${value}'`
        })
        .join(',')})`
    })
  
    const insertQuery = `
      INSERT INTO "${tableName}" ("${columns.join('", "')}")
      VALUES ${values.join(',')}
      ON CONFLICT DO NOTHING;
    `

    const res = await _db.$executeRawUnsafe(insertQuery)
    return { count: res }
  }

  export const getColumnTypes = async (tableName: string): Promise<Record<string, string>> => {
    const res: { column_name: string; data_type: string }[] =
      await db.$queryRawUnsafe(`
        SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${tableName}'
        AND is_generated = 'NEVER'
        ORDER BY ordinal_position ASC
    `)
    // Create a new object with the column types
    return res.reduce((acc, curr) => {
        acc[curr.column_name] = curr.data_type
        return acc
        }, {} as Record<string, string>)
  }
