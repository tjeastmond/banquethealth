import {parse} from "csv-parse";
import {camelCase, map} from "lodash";
import {createReadStream} from "fs";
import {join} from "path";
import { db } from "../../../src/db";

const formatTextValueOutput = (value: string) => {
    // Double any ' characters to escape them
    return value.replace(/'/g, "''")
  }
  
  const formatArrayValueOutput = (value: string) => {
    return value.replace('[', '{').replace(']', '}')
  }

const formatSeedData =
  (columnTypes: Record<string, string>) => (value: unknown, context: any) => {
    const type = columnTypes[context.column]
    if (!type) {
      return value
    }
    if (value === '') {
      return null
    }
    if (type === 'ARRAY') {
      return formatArrayValueOutput(value as string)
    }
    if (type === 'text' || type === 'character varying') {
      return formatTextValueOutput(value as string)
    }
    return value
  }

export const parseCsv = (filePath: string, columnTypes: Record<string, string>): Promise<any> => {

    return new Promise((resolve, reject) => {

        const records: any[] = []

        const parser = parse({
            delimiter: ',',
            columns: true,
            cast: formatSeedData(columnTypes)
        })
        parser.on('readable', function () {
            let record;
            while ((record = parser.read()) !== null) {
                records.push(record);
            }
        });

        parser.on('end', function () {
            resolve(records)
        });

        parser.on('error', function (err) {
            reject(err)
        });

        const stream = createReadStream(filePath)
        stream.pipe(parser)

    })

}
