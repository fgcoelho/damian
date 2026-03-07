import fs from "node:fs";
import path from "node:path";
import { parentPort } from "node:worker_threads";
import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { pgDump } from "@electric-sql/pglite-tools/pg_dump";
import { readTypings } from "../../utils/typings-parser";
import { generateTablesOutput, generateTypingsOutput } from "./output";
import { parseTables } from "./schema-parser";

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

export async function buildSchemaFromMigrations(
  migrationsDir: string,
  migrationFilenames: string[],
): Promise<string> {
  const pg = await PGlite.create({ extensions: { uuid_ossp } });

  const migrations = migrationFilenames.map((filename) =>
    readMigrationUpSection(migrationsDir, filename),
  );

  const BATCH_SIZE = 100;

  for (let i = 0; i < migrations.length; i += BATCH_SIZE) {
    const batch = migrations.slice(i, i + BATCH_SIZE);

    const joinedBatch = batch.join("\n");

    await pg.exec(joinedBatch);
  }

  const result = await pgDump({ pg });

  const text = stripSqlComments(await result.text());

  return text;
}

export async function run(input: GenerateWorkerInput): Promise<void> {
  const { migrationsDir, dumpMigrations, allMigrations, typingsFile } = input;

  const cleanDump = await buildSchemaFromMigrations(
    migrationsDir,
    dumpMigrations,
  );

  const fullSchema = await buildSchemaFromMigrations(
    migrationsDir,
    allMigrations,
  );

  const customTypings = await readTypings(typingsFile);
  const tables = parseTables(fullSchema, customTypings);

  parentPort?.postMessage({
    cleanDump,
    tablesOutput: generateTablesOutput(tables, customTypings),
    typingsOutput: generateTypingsOutput(tables),
  } satisfies GenerateWorkerOutput);
}
