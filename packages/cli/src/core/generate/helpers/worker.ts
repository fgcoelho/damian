import fs from "node:fs";
import path from "node:path";
import { parentPort } from "node:worker_threads";
import { type PGlite, PGlite as PGliteClient } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { pgDump } from "@electric-sql/pglite-tools/pg_dump";
import { readTypings } from "../../../utils/typings-parser";
import {
  generateTablesOutput,
  generateTypingsOutput,
  toTableLike,
} from "../outputs/damian-output";
import { generateDrizzleTablesOutput } from "../outputs/drizzle-output";
import { introspectDatabaseSchema } from "./schema-introspection";
import type {
  DatabaseSchema,
  GeneratedArtifact,
  OutputConfig,
} from "./schema-model";
import { getColumnType, type ParsedTable } from "./schema-parser";

export interface GenerateWorkerInput {
  output: OutputConfig;
  migrationsDir: string;
  dumpMigrations: string[];
  allMigrations: string[];
  typingsFile: string;
}

export interface GenerateWorkerOutput {
  cleanDump: string;
  artifacts: GeneratedArtifact[];
}

function readMigrationUpSection(
  migrationsDir: string,
  filename: string,
): string {
  const content = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
  const match = content.match(/-- migrate:up([\s\S]*?)(?:-- migrate:down|$)/);
  if (!match) {
    throw new Error(
      `Migration file ${filename} is missing a -- migrate:up section`,
    );
  }
  return match[1].trim();
}

function stripSqlComments(raw: string): string {
  return raw
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function createDatabaseFromMigrations(
  migrationsDir: string,
  migrationFilenames: string[],
): Promise<PGlite> {
  const pg = await PGliteClient.create({ extensions: { uuid_ossp } });

  const migrations = migrationFilenames.map((filename) =>
    readMigrationUpSection(migrationsDir, filename),
  );

  const BATCH_SIZE = 100;

  for (let i = 0; i < migrations.length; i += BATCH_SIZE) {
    const batch = migrations.slice(i, i + BATCH_SIZE);

    const joinedBatch = batch.join("\n");

    await pg.exec(joinedBatch);
  }

  return pg;
}

async function dumpDatabaseSchema(pg: PGlite): Promise<string> {
  const result = await pgDump({ pg });
  return stripSqlComments(await result.text());
}

export async function buildSchemaFromMigrations(
  migrationsDir: string,
  migrationFilenames: string[],
): Promise<string> {
  const pg = await createDatabaseFromMigrations(
    migrationsDir,
    migrationFilenames,
  );

  try {
    return await dumpDatabaseSchema(pg);
  } finally {
    await pg.close();
  }
}

function toParsedTables(
  schema: DatabaseSchema,
  customTypings: Record<string, string>,
): ParsedTable[] {
  return schema.tables.map((table) => ({
    schema: table.schema,
    table: table.table,
    columns: table.columns.map((column) => {
      const key = `${table.schema}.${table.table}.${column.name}`;
      const columnType = getColumnType(column.fullDataType);
      const schemaType = customTypings[key]
        ? `typings["${key}"].type`
        : column.nullable
          ? `s.nullable(${columnType.schema})`
          : columnType.schema;

      return {
        name: column.name,
        schemaType,
        sqlType: columnType.db,
      };
    }),
  }));
}

function generateArtifacts(
  output: OutputConfig,
  schema: DatabaseSchema,
  customTypings: Record<string, string>,
): GeneratedArtifact[] {
  if (output.kind === "drizzle") {
    return [
      {
        fileName: "tables.ts",
        content: generateDrizzleTablesOutput(schema, customTypings, output),
      },
      {
        fileName: "typings.ts",
        content: generateTypingsOutput(toTableLike(schema.tables), "drizzle"),
      },
    ];
  }

  const tables = toParsedTables(schema, customTypings);

  return [
    {
      fileName: "tables.ts",
      content: generateTablesOutput(tables, customTypings),
    },
    {
      fileName: "typings.ts",
      content: generateTypingsOutput(tables),
    },
  ];
}

export async function run(input: GenerateWorkerInput): Promise<void> {
  const { output, migrationsDir, dumpMigrations, allMigrations, typingsFile } =
    input;

  const [cleanDumpDatabase, fullDatabase, customTypings] = await Promise.all([
    createDatabaseFromMigrations(migrationsDir, dumpMigrations),
    createDatabaseFromMigrations(migrationsDir, allMigrations),
    readTypings(typingsFile),
  ]);

  try {
    const [cleanDump, schema] = await Promise.all([
      dumpDatabaseSchema(cleanDumpDatabase),
      introspectDatabaseSchema(fullDatabase),
    ]);

    parentPort?.postMessage({
      cleanDump,
      artifacts: generateArtifacts(output, schema, customTypings),
    } satisfies GenerateWorkerOutput);
  } finally {
    await Promise.all([cleanDumpDatabase.close(), fullDatabase.close()]);
  }
}
