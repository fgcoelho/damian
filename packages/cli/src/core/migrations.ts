import fs from "node:fs";
import path from "node:path";
import type { DamianConfig } from "./config.js";

export function resolveMigrationsDir(cfg: DamianConfig): string {
  return path.resolve(process.cwd(), cfg.root, ".migrations");
}

export function resolveGeneratedDir(cfg: DamianConfig): string {
  return path.resolve(process.cwd(), cfg.root, ".generated");
}

export function listMigrationFiles(migrationsDir: string): string[] {
  if (
    !fs.existsSync(migrationsDir) ||
    !fs.statSync(migrationsDir).isDirectory()
  ) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No migration files found in ${migrationsDir}`);
  }

  return files;
}

export function filterDumpMigrations(
  allFiles: string[],
  devDumpIgnore: string[] = [],
): string[] {
  const ignored = new Set(devDumpIgnore);
  return allFiles.filter((f) => !ignored.has(f));
}
