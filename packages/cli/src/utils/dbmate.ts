import chalk from "chalk";
import { resolveBinary } from "dbmate";
import logSymbols from "log-symbols";
import type { DamianConfig } from "../config.js";

export function dbmateBin(): string {
  return resolveBinary();
}

export function dbmateEnv(
  cfg: DamianConfig,
  migrationsDir: string,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: cfg.url,
    DBMATE_MIGRATIONS_DIR: migrationsDir,
    DBMATE_NO_DUMP_SCHEMA: "true",
  };

  if (cfg.migrationsTable) {
    env.DBMATE_MIGRATIONS_TABLE = cfg.migrationsTable;
  }

  return env;
}

export function formatDbmateLine(line: string): string {
  const applied = line.match(/^Applied:\s+(\S+)\s+in\s+(.+)$/);
  if (applied) {
    return `${logSymbols.success} ${applied[1]} ${chalk.dim(`(${applied[2]})`)}`;
  }

  const applying = line.match(/^Applying:\s+(\S+)$/);
  if (applying) {
    return chalk.dim(`applying ${applying[1]}...`);
  }

  const creating = line.match(/^Creating\s+(.+)$/);
  if (creating) {
    return chalk.dim(`creating ${creating[1]}`);
  }

  return chalk.dim(line);
}
