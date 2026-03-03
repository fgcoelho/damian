import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Worker } from "node:worker_threads";
import chalk from "chalk";
import logSymbols from "log-symbols";
import ora from "ora";
import { BaseCommand } from "../base.js";
import type {
  GenerateWorkerInput,
  GenerateWorkerOutput,
} from "../workers/generate.js";

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getColumnType(type: string): { schema: string; db: string } {
  type = type.toLowerCase().trim();

  if (type.endsWith("[]")) {
    const baseType = type.slice(0, -2).trim();
    const base = getColumnType(baseType);
    return {
      schema: `s.array(${base.schema})`,
      db: `${base.db}[]`,
    };
  }

  if (type.startsWith("uuid"))
    return { schema: 's.string("uuid")', db: "uuid" };
  if (type.startsWith("character varying") || type.startsWith("varchar"))
    return { schema: 's.string("varchar")', db: "varchar" };
  if (type.startsWith("character") || type.startsWith("char"))
    return { schema: 's.string("char")', db: "char" };
  if (type.startsWith("text"))
    return { schema: 's.string("text")', db: "text" };
  if (type.startsWith("bit varying") || type.startsWith("varbit"))
    return { schema: 's.string("varbit")', db: "varbit" };
  if (type.startsWith("bit")) return { schema: 's.string("bit")', db: "bit" };
  if (type.startsWith("jsonb"))
    return { schema: 's.any("jsonb")', db: "jsonb" };
  if (type.startsWith("json")) return { schema: 's.any("json")', db: "json" };
  if (type.startsWith("xml")) return { schema: 's.string("xml")', db: "xml" };

  if (type.startsWith("bigint") || type.startsWith("int8"))
    return { schema: 's.number("bigint")', db: "bigint" };
  if (type.startsWith("bigserial") || type.startsWith("serial8"))
    return { schema: 's.number("bigserial")', db: "bigserial" };
  if (
    type.startsWith("integer") ||
    type.startsWith("int") ||
    type.startsWith("int4")
  )
    return { schema: 's.number("integer")', db: "integer" };
  if (type.startsWith("smallint") || type.startsWith("int2"))
    return { schema: 's.number("smallint")', db: "smallint" };
  if (type.startsWith("smallserial") || type.startsWith("serial2"))
    return { schema: 's.number("smallserial")', db: "smallserial" };
  if (type.startsWith("serial") || type.startsWith("serial4"))
    return { schema: 's.number("serial")', db: "serial" };
  if (type.startsWith("real") || type.startsWith("float4"))
    return { schema: 's.number("real")', db: "real" };
  if (
    type.startsWith("double precision") ||
    type.startsWith("float8") ||
    type.startsWith("float")
  )
    return { schema: 's.number("float8")', db: "double precision" };
  if (type.startsWith("numeric") || type.startsWith("decimal"))
    return { schema: 's.number("numeric")', db: "numeric" };
  if (type.startsWith("money"))
    return { schema: 's.number("money")', db: "money" };

  if (type.startsWith("boolean") || type.startsWith("bool"))
    return { schema: "s.boolean()", db: "boolean" };

  if (type.startsWith("date"))
    return { schema: 's.string("date")', db: "date" };
  if (type.startsWith("time") && !type.includes("timestamp"))
    return { schema: 's.string("time")', db: "time" };
  if (type.startsWith("timestamptz"))
    return { schema: 's.string("timestamptz")', db: "timestamptz" };
  if (type.startsWith("timestamp"))
    return { schema: 's.string("timestamp")', db: "timestamp" };
  if (type.startsWith("interval"))
    return { schema: 's.string("interval")', db: "interval" };

  if (type.startsWith("inet") || type.startsWith("cidr"))
    return { schema: 's.string("inet")', db: "inet" };
  if (type.startsWith("macaddr"))
    return { schema: 's.string("macaddr")', db: "macaddr" };

  if (
    ["point", "line", "lseg", "box", "path", "polygon", "circle"].some((t) =>
      type.startsWith(t),
    )
  ) {
    return { schema: 's.any("geometry")', db: "geometry" };
  }

  return { schema: 's.any("unknown")', db: "unknown" };
}

const TABLE_REGEX = /CREATE TABLE\s+([\w"]+)\.([\w"]+)\s*\(([\s\S]+?)\);/gi;

export function parseTables(
  sql: string,
  typings: Record<string, string>,
): Array<{
  schema: string;
  table: string;
  columns: { name: string; schemaType: string; sqlType: string }[];
}> {
  return [...sql.matchAll(TABLE_REGEX)].map((match) => {
    const schema = match[1].replace(/"/g, "");
    const table = match[2].replace(/"/g, "");
    const columnsRaw = match[3];

    const columnDefs = columnsRaw
      .split(/\r?\n/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
      .filter(
        (c) =>
          !c.toUpperCase().startsWith("CONSTRAINT") &&
          !c.toUpperCase().startsWith("PRIMARY KEY") &&
          !c.toUpperCase().startsWith("FOREIGN KEY") &&
          !c.toUpperCase().startsWith("UNIQUE"),
      );

    const columns = columnDefs
      .map((col) => {
        const colMatch = col.match(
          /^"?(\w+)"?\s+([a-zA-Z ]+(?:\(\d+\))?(?:\s+without time zone)?(?:\[\])?)(.*)$/i,
        );

        if (!colMatch) return null;

        const name = colMatch[1];
        const type = colMatch[2].toLowerCase();

        const key = `${schema}.${table}.${name}`;
        const columnType = getColumnType(type);

        if (typings[key]) {
          const customTyping = `typings["${key}"].type`;
          return { name, schemaType: customTyping, sqlType: columnType.db };
        }

        if (!col.includes("NOT NULL")) {
          columnType.schema = `s.nullable(${columnType.schema})`;
        }

        return { name, schemaType: columnType.schema, sqlType: columnType.db };
      })
      .filter(
        (c): c is { name: string; schemaType: string; sqlType: string } =>
          c !== null,
      );

    return { schema, table, columns };
  });
}

export function readTypings(typingsFile: string): Record<string, string> {
  const typings: Record<string, string> = {};

  if (!fs.existsSync(typingsFile)) return typings;

  const typingsSrc = fs.readFileSync(typingsFile, "utf8");

  const newFormatMatch = typingsSrc.match(
    /export\s+default\s+typings\s*\(\s*({[\s\S]+?})\s*\)/,
  );

  if (newFormatMatch) {
    const objContent = newFormatMatch[1];

    function findMatchingBrace(content: string, start: number): number {
      let depth = 1;
      for (let i = start; i < content.length; i++) {
        if (content[i] === "{") depth++;
        if (content[i] === "}") {
          depth--;
          if (depth === 0) return i;
        }
      }
      return -1;
    }

    function parseObject(content: string, path: string[]): void {
      const trimmed = content.trim();
      if (!trimmed) return;

      let i = 0;
      while (i < trimmed.length) {
        if (!/\w/.test(trimmed[i])) {
          i++;
          continue;
        }

        const keyStart = i;
        while (i < trimmed.length && /[\w_]/.test(trimmed[i])) i++;
        const key = trimmed.substring(keyStart, i);

        while (i < trimmed.length && /\s/.test(trimmed[i])) i++;

        if (i >= trimmed.length || trimmed[i] !== ":") {
          i++;
          continue;
        }
        i++;

        while (i < trimmed.length && /\s/.test(trimmed[i])) i++;

        if (i < trimmed.length && trimmed[i] === "{") {
          const braceStart = i + 1;
          const braceEnd = findMatchingBrace(trimmed, braceStart);
          if (braceEnd === -1) break;

          const innerContent = trimmed.substring(braceStart, braceEnd);
          parseObject(innerContent, [...path, key]);

          i = braceEnd + 1;
        } else {
          const valueStart = i;
          let depth = 0;
          while (
            i < trimmed.length &&
            (trimmed[i] !== "," || depth > 0) &&
            (trimmed[i] !== "}" || depth > 0)
          ) {
            if (trimmed[i] === "(" || trimmed[i] === "[" || trimmed[i] === "{")
              depth++;
            if (trimmed[i] === ")" || trimmed[i] === "]" || trimmed[i] === "}")
              depth--;
            i++;
          }

          const value = trimmed.substring(valueStart, i).trim();
          if (value && path.length > 0) {
            const fullKey = [...path, key].join(".");
            typings[fullKey] = "custom";
          }

          if (i < trimmed.length && trimmed[i] === ",") i++;
        }
      }
    }

    parseObject(objContent, []);
  } else {
    const oldFormatMatch = typingsSrc.match(/export\s+default\s+({[\s\S]+});?/);

    if (oldFormatMatch) {
      const objSrc = oldFormatMatch[1];
      const entries = [...objSrc.matchAll(/["']([\w.]+)["']\s*:\s*([^,}]+)/g)];
      for (const e of entries) {
        typings[e[1]] = e[2].trim();
      }
    }
  }

  return typings;
}

export default class Generate extends BaseCommand<typeof Generate> {
  static description = "Generate TypeScript types from the database schema";

  public async run(): Promise<void> {
    const cwd = process.cwd();
    const migrationsDir = path.resolve(cwd, this.cfg.root, ".migrations");
    const tablesFile = path.resolve(
      cwd,
      this.cfg.root,
      ".generated",
      "tables.ts",
    );
    const typingsOutputFile = path.resolve(
      cwd,
      this.cfg.root,
      ".generated",
      "typings.ts",
    );
    const dbSqlFile = path.resolve(cwd, this.cfg.root, "db.sql");
    const typingsFile = path.resolve(cwd, this.cfg.root, "typings.ts");

    fs.mkdirSync(path.dirname(tablesFile), { recursive: true });

    if (
      !fs.existsSync(migrationsDir) ||
      !fs.statSync(migrationsDir).isDirectory()
    ) {
      this.error(`Migrations directory not found: ${migrationsDir}`);
    }

    const allMigrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    if (allMigrationFiles.length === 0) {
      this.error(`No migration files found in ${migrationsDir}`);
    }

    const devDumpIgnore = new Set(this.cfg.devDumpIgnore ?? []);
    const dumpMigrations = allMigrationFiles.filter(
      (f) => !devDumpIgnore.has(f),
    );

    const spin = ora({ text: "Generating types...", spinner: "dots" }).start();

    const workerInput: GenerateWorkerInput = {
      migrationsDir,
      dumpMigrations,
      allMigrations: allMigrationFiles,
      typingsFile,
    };

    const workerFile = path.join(__dirname, "generate.cjs");

    const result = await new Promise<GenerateWorkerOutput>(
      (resolve, reject) => {
        const worker = new Worker(workerFile, { workerData: workerInput });
        worker.once("message", resolve);
        worker.once("error", reject);
      },
    );

    fs.writeFileSync(dbSqlFile, result.cleanDump, "utf8");
    fs.writeFileSync(tablesFile, result.tablesOutput, "utf8");
    fs.writeFileSync(typingsOutputFile, result.typingsOutput, "utf8");

    try {
      execSync(`biome format --write ${tablesFile} ${typingsOutputFile}`, {
        stdio: "ignore",
      });
      execSync(`biome check --fix ${tablesFile} ${typingsOutputFile}`, {
        stdio: "ignore",
      });
      execSync(`biome lint --fix ${tablesFile} ${typingsOutputFile}`, {
        stdio: "ignore",
      });
    } catch {}

    spin.succeed(
      `Generated ${chalk.cyan(path.relative(cwd, tablesFile))} and ${chalk.cyan(path.relative(cwd, typingsOutputFile))}`,
    );
    this.log(
      `${logSymbols.success} Dump ${chalk.cyan(path.relative(cwd, dbSqlFile))}`,
    );
  }
}
