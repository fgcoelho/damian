import fs from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";
import { getTsconfigAliases } from "../utils/tsconfig";

export type DamianConfig = {
  driver: "postgres";
  root: string;
  env: string;
  url: string | undefined;
  migrationsTable?: string;
  devDumpIgnore?: string[];
};

type UserConfig = {
  driver?: "postgres";
  root?: string;
  env?: string;
  url?: string;
  migrationsTable?: string;
  devDumpIgnore?: string[];
};

export function config(userConfig: UserConfig): DamianConfig {
  return {
    driver: userConfig.driver ?? "postgres",
    root: userConfig.root ?? "./damian",
    env: userConfig.env ?? ".env",
    url: userConfig.url ?? process.env.DATABASE_URL,
    migrationsTable: userConfig.migrationsTable,
    devDumpIgnore: userConfig.devDumpIgnore ?? [],
  };
}

const CONFIG_FILENAME = "damian.config.ts";

function resolveConfigPath(configPath?: string): string {
  const cwd = process.cwd();
  return configPath
    ? path.resolve(cwd, configPath)
    : path.resolve(cwd, CONFIG_FILENAME);
}

async function importConfigModule(resolvedPath: string): Promise<unknown> {
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Config file not found: ${resolvedPath}\n\nCreate a damian.config.ts file in your project root:\n\n  import { config } from "damian";\n\n  export default config({\n    driver: "postgres",\n    url: process.env.DATABASE_URL,\n  });\n`,
    );
  }

  const jiti = createJiti(import.meta.url, {
    alias: getTsconfigAliases(process.cwd()),
  });

  const mod = await jiti.import(resolvedPath);
  return (mod as { default?: DamianConfig }).default ?? (mod as DamianConfig);
}

function validateConfigModule(
  loaded: unknown,
  resolvedPath: string,
): DamianConfig {
  if (!loaded || typeof loaded !== "object" || !("driver" in loaded)) {
    throw new Error(
      `Invalid config file at ${resolvedPath}.\nMake sure you export a default value using the config() function from "damian".`,
    );
  }
  return loaded as DamianConfig;
}

export async function loadConfig(configPath?: string): Promise<DamianConfig> {
  const resolvedPath = resolveConfigPath(configPath);
  const loaded = await importConfigModule(resolvedPath);
  return validateConfigModule(loaded, resolvedPath);
}

export function requireDatabaseUrl(cfg: DamianConfig): string {
  if (!cfg.url) {
    throw new Error(
      "No database URL configured. Set DATABASE_URL in your environment or specify url in damian.config.ts.",
    );
  }
  return cfg.url;
}

function isComment(line: string): boolean {
  return !line || line.startsWith("#");
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (isComment(trimmed)) return null;

  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) return null;

  const key = trimmed.slice(0, eqIndex).trim();
  const value = stripQuotes(trimmed.slice(eqIndex + 1).trim());
  return { key, value };
}

export function loadEnv(envPath: string): void {
  const resolvedEnvPath = path.resolve(process.cwd(), envPath);
  if (!fs.existsSync(resolvedEnvPath)) return;

  const content = fs.readFileSync(resolvedEnvPath, "utf8");

  for (const line of content.split("\n")) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (!(parsed.key in process.env)) {
      process.env[parsed.key] = parsed.value;
    }
  }
}
