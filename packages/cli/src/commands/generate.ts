import fs from "node:fs";
import path from "node:path";
import { Worker } from "node:worker_threads";
import chalk from "chalk";
import ora from "ora";
import { BaseCommand } from "../base";
import type {
  GenerateWorkerInput,
  GenerateWorkerOutput,
} from "../core/generate/worker";
import { logger } from "../core/logger";
import {
  filterDumpMigrations,
  listMigrationFiles,
  resolveGeneratedDir,
  resolveMigrationsDir,
} from "../core/migrations";
import { formatFiles } from "../utils/prettier";

export { capitalize, generateTypingsOutput } from "../core/generate/output";
export { getColumnType, parseTables } from "../core/generate/schema-parser";
export { readTypings } from "../utils/typings-parser";

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
  tablesFile: string,
  typingsOutputFile: string,
  result: GenerateWorkerOutput,
): void {
  fs.writeFileSync(dbSqlFile, result.cleanDump, "utf8");
  fs.writeFileSync(tablesFile, result.tablesOutput, "utf8");
  fs.writeFileSync(typingsOutputFile, result.typingsOutput, "utf8");
}

export default class Generate extends BaseCommand<typeof Generate> {
  static description = "Generate TypeScript types from the database schema";

  public async run(): Promise<void> {
    const cwd = process.cwd();
    const migrationsDir = resolveMigrationsDir(this.cfg);
    const generatedDir = resolveGeneratedDir(this.cfg);
    const tablesFile = path.join(generatedDir, "tables.ts");
    const typingsOutputFile = path.join(generatedDir, "typings.ts");
    const dbSqlFile = path.resolve(cwd, this.cfg.root, "db.sql");
    const typingsFile = path.resolve(cwd, this.cfg.root, "typings.ts");

    fs.mkdirSync(generatedDir, { recursive: true });

    const allMigrations = listMigrationFiles(migrationsDir);
    const dumpMigrations = filterDumpMigrations(
      allMigrations,
      this.cfg.devDumpIgnore,
    );

    const spin = ora({ text: "Generating types...", spinner: "dots" }).start();

    const result = await runGenerateWorker({
      migrationsDir,
      dumpMigrations,
      allMigrations,
      typingsFile,
    });

    writeGeneratedFiles(dbSqlFile, tablesFile, typingsOutputFile, result);
    await formatFiles([tablesFile, typingsOutputFile]);

    spin.succeed(
      `Generated ${chalk.cyan(path.relative(cwd, tablesFile))} and ${chalk.cyan(path.relative(cwd, typingsOutputFile))}`,
    );
    logger.success(`Dump ${chalk.cyan(path.relative(cwd, dbSqlFile))}`);
  }
}
