import fs from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";
import { getTsconfigAliases } from "./utils/tsconfig.js";

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

export async function loadConfig(configPath?: string): Promise<DamianConfig> {
  const cwd = process.cwd();

  const resolvedPath = configPath
    ? path.resolve(cwd, configPath)
    : path.resolve(cwd, CONFIG_FILENAME);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Config file not found: ${resolvedPath}\n\nCreate a damian.config.ts file in your project root:\n\n  import { config } from "damian";\n\n  export default config({\n    driver: "postgres",\n    url: process.env.DATABASE_URL,\n  });\n`,
    );
  }

  const jiti = createJiti(import.meta.url, {
    alias: getTsconfigAliases(cwd),
  });
  const mod = await jiti.import(resolvedPath);
  const loaded =
    (mod as { default?: DamianConfig }).default ?? (mod as DamianConfig);

  if (!loaded || typeof loaded !== "object" || !("driver" in loaded)) {
    throw new Error(
      `Invalid config file at ${resolvedPath}.\nMake sure you export a default value using the config() function from "damian".`,
    );
  }

  return loaded as DamianConfig;
}

export function loadEnv(envPath: string): void {
  const cwd = process.cwd();
  const resolvedEnvPath = path.resolve(cwd, envPath);

  if (!fs.existsSync(resolvedEnvPath)) {
    return;
  }

  const content = fs.readFileSync(resolvedEnvPath, "utf8");

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
