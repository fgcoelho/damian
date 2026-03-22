import fs from "node:fs";
import path from "node:path";
import { Worker } from "node:worker_threads";
import chalk from "chalk";
import ora from "ora";
import { BaseCommand } from "../base";
import type {
  GenerateWorkerInput,
  GenerateWorkerOutput,
} from "../core/generate/helpers/worker";
import { generateDrizzleTablesOutput } from "../core/generate/outputs/drizzle-output";
import { logger } from "../core/logger";
import {
  filterDumpMigrations,
  listMigrationFiles,
  resolveGeneratedDir,
  resolveMigrationsDir,
} from "../core/migrations";
import { formatFiles } from "../utils/prettier";

export {
  capitalize,
  generateTypingsOutput,
} from "../core/generate/outputs/damian-output";
export { generateDrizzleTablesOutput };
export {
  getColumnType,
  parseTables,
} from "../core/generate/helpers/schema-parser";
export { readTypings } from "../utils/typings-parser";

export function resolveGenerateOutputPaths(generatedDir: string): {
  tablesFile: string;
  typingsFile: string;
  dbSqlFile: string;
} {
  return {
    tablesFile: path.join(generatedDir, "tables.ts"),
    typingsFile: path.join(generatedDir, "typings.ts"),
    dbSqlFile: path.join(generatedDir, "db.sql"),
  };
}

function runGenerateWorker(
  input: GenerateWorkerInput,
): Promise<GenerateWorkerOutput> {
  const workerFile = path.join(__dirname, "generate.cjs");
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerFile, { workerData: input });
    worker.once("message", resolve);
    worker.once("error", reject);
  });
}

function writeGeneratedFiles(
  dbSqlFile: string,
  generatedDir: string,
  result: GenerateWorkerOutput,
): string[] {
  fs.writeFileSync(dbSqlFile, result.cleanDump, "utf8");

  const filePaths: string[] = [];
  for (const artifact of result.artifacts) {
    const filePath = path.join(generatedDir, artifact.fileName);
    fs.writeFileSync(filePath, artifact.content, "utf8");
    filePaths.push(filePath);
  }

  return filePaths;
}

export default class Generate extends BaseCommand<typeof Generate> {
  static description = "Generate TypeScript types from the database schema";

  public async run(): Promise<void> {
    const cwd = process.cwd();
    const migrationsDir = resolveMigrationsDir(this.cfg);
    const generatedDir = resolveGeneratedDir(this.cfg);
    const {
      tablesFile,
      typingsFile: typingsOutputFile,
      dbSqlFile,
    } = resolveGenerateOutputPaths(generatedDir);
    const typingsFile = path.resolve(cwd, this.cfg.root, "typings.ts");

    fs.mkdirSync(generatedDir, { recursive: true });

    const allMigrations = listMigrationFiles(migrationsDir);
    const dumpMigrations = filterDumpMigrations(
      allMigrations,
      this.cfg.devDumpIgnore,
    );

    const spin = ora({ text: "Generating types...", spinner: "dots" }).start();

    const result = await runGenerateWorker({
      output: this.cfg.output,
      migrationsDir,
      dumpMigrations,
      allMigrations,
      typingsFile,
    });

    const generatedFiles = writeGeneratedFiles(dbSqlFile, generatedDir, result);
    await formatFiles(generatedFiles);

    spin.succeed(
      `Generated ${chalk.cyan(path.relative(cwd, tablesFile))} and ${chalk.cyan(path.relative(cwd, typingsOutputFile))}`,
    );
    logger.success(`Dump ${chalk.cyan(path.relative(cwd, dbSqlFile))}`);
  }
}
