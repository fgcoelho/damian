import fs from "node:fs";
import path from "node:path";
import { parentPort, workerData } from "node:worker_threads";
import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { pgDump } from "@electric-sql/pglite-tools/pg_dump";
import Case from "case";
import { capitalize, parseTables, readTypings } from "../commands/generate.js";

export interface GenerateWorkerInput {
  migrationsDir: string;
  dumpMigrations: string[];
  allMigrations: string[];
  typingsFile: string;
}

export interface GenerateWorkerOutput {
  cleanDump: string;
  tablesOutput: string;
  typingsOutput: string;
}

const { migrationsDir, dumpMigrations, allMigrations, typingsFile } =
  workerData as GenerateWorkerInput;

function readMigrationUp(filename: string): string {
  const content = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
  const match = content.match(/-- migrate:up([\s\S]*?)(?:-- migrate:down|$)/);
  if (!match) {
    throw new Error(
      `Migration file ${filename} is missing a -- migrate:up section`,
    );
  }
  return match[1].trim();
}

async function run() {
  const dumpSqls = dumpMigrations.map(readMigrationUp);

  let pg = await PGlite.create({ extensions: { uuid_ossp } });
  await pg.exec(dumpSqls.join("\n"));

  const dumpResult = await pgDump({ pg });
  const dumpRaw = await dumpResult.text();

  const cleanDump = dumpRaw
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const allSqls = allMigrations.map(readMigrationUp);

  pg = await PGlite.create({ extensions: { uuid_ossp } });
  await pg.exec(allSqls.join("\n"));

  const fullDump = await pgDump({ pg });
  const fullDumpRaw = await fullDump.text();

  const fullSql = fullDumpRaw
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const customTypings = readTypings(typingsFile);
  const hasCustomTypings = fs.existsSync(typingsFile);

  const tables = parseTables(fullSql, customTypings);

  // Generate typings.ts with shadow schema
  let typingsOutput = `// This file is auto-generated from the database schema. Do not edit directly.\nimport { typingsFactory } from '@damiandb/pg';\n\n`;
  typingsOutput += `export const typings = typingsFactory<{\n`;

  // Group tables by schema
  const tablesBySchema = new Map<string, typeof tables>();
  for (const t of tables) {
    if (!tablesBySchema.has(t.schema)) {
      tablesBySchema.set(t.schema, []);
    }
    tablesBySchema.get(t.schema)?.push(t);
  }

  // Generate nested structure as type
  for (const [schema, schemaTables] of tablesBySchema) {
    typingsOutput += `  ${Case.camel(schema)}: {\n`;
    for (const t of schemaTables) {
      typingsOutput += `    ${Case.camel(t.table)}: {\n`;
      for (const col of t.columns) {
        typingsOutput += `      ${col.name}: any;\n`;
      }
      typingsOutput += `    };\n`;
    }
    typingsOutput += `  };\n`;
  }
  typingsOutput += `}>();\n`;

  // Generate tables.ts
  let tablesOutput = `// This file is auto-generated from the database schema. Do not edit directly.\nimport { s, table } from '@damiandb/pg';\n`;

  if (hasCustomTypings) {
    tablesOutput += `import typings from '../typings';\n`;
  }

  tablesOutput += `\n`;

  const schemas = [...new Set(tables.map((t) => t.schema.toUpperCase()))];
  tablesOutput += `enum Schema {\n${schemas.map((s) => `    ${s} = "${s.toLowerCase()}"`).join(",\n")}\n}\n\n`;

  for (const t of tables) {
    const tableCamel = Case.camel(t.table);
    const schemaCamel = Case.camel(t.schema);
    tablesOutput += `export const ${capitalize(tableCamel)}Table = table(Schema.${t.schema.toUpperCase()}, "${t.table}", {\n`;
    for (const col of t.columns) {
      const key = `${t.schema}.${t.table}.${col.name}`;
      const hasCustomType = customTypings[key];

      if (hasCustomType) {
        // Use s.externalSchema with custom typing - nested path: schema.table.column
        tablesOutput += `    ${col.name}: s.externalSchema(typings.${schemaCamel}.${tableCamel}.${col.name}, "${col.sqlType}"),\n`;
      } else {
        // Use standard schema builder
        tablesOutput += `    ${col.name}: ${col.schemaType},\n`;
      }
    }
    tablesOutput += "});\n\n";
  }

  parentPort?.postMessage({
    cleanDump,
    tablesOutput,
    typingsOutput,
  } satisfies GenerateWorkerOutput);
}

run().catch((err) => {
  throw err;
});
