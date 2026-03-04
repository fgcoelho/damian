import fs from "node:fs";
import { createJiti } from "jiti";
import { getTsconfigAliases } from "./tsconfig.js";

type TypingsShape = Record<string, Record<string, Record<string, unknown>>>;

function isTypingsShape(value: unknown): value is TypingsShape {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectKeys(typings: TypingsShape): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [schema, tables] of Object.entries(typings)) {
    if (!isTypingsShape(tables)) continue;
    for (const [table, columns] of Object.entries(tables)) {
      if (!isTypingsShape(columns)) continue;
      for (const column of Object.keys(columns)) {
        result[`${schema}.${table}.${column}`] = "custom";
      }
    }
  }
  return result;
}

async function importTypingsModule(typingsFile: string): Promise<unknown> {
  const jiti = createJiti(import.meta.url, {
    alias: getTsconfigAliases(process.cwd()),
  });
  const mod = await jiti.import(typingsFile);
  return (mod as { default?: unknown }).default ?? mod;
}

export async function readTypings(
  typingsFile: string,
): Promise<Record<string, string>> {
  if (!fs.existsSync(typingsFile)) return {};

  const exported = await importTypingsModule(typingsFile);
  if (!isTypingsShape(exported)) return {};

  return collectKeys(exported);
}
