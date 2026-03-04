import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  capitalize,
  generateTypingsOutput,
  getColumnType,
  parseTables,
  readTypings,
} from "../src/commands/generate.js";
import { buildSchemaFromMigrations } from "../src/core/generate/worker.js";

describe("capitalize()", () => {
  it("uppercases the first character", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  it("leaves the rest of the string unchanged", () => {
    expect(capitalize("fooBar")).toBe("FooBar");
  });

  it("handles a single character", () => {
    expect(capitalize("a")).toBe("A");
  });

  it("handles an already-capitalized string", () => {
    expect(capitalize("World")).toBe("World");
  });

  it("handles an empty string", () => {
    expect(capitalize("")).toBe("");
  });
});

describe("getColumnType()", () => {
  it('maps uuid to s.string("uuid")', () => {
    expect(getColumnType("uuid")).toEqual({
      schema: 's.string("uuid")',
      db: "uuid",
    });
  });

  it('maps text to s.string("text")', () => {
    expect(getColumnType("text")).toEqual({
      schema: 's.string("text")',
      db: "text",
    });
  });

  it('maps character varying to s.string("varchar")', () => {
    expect(getColumnType("character varying")).toEqual({
      schema: 's.string("varchar")',
      db: "varchar",
    });
  });

  it('maps varchar to s.string("varchar")', () => {
    expect(getColumnType("varchar")).toEqual({
      schema: 's.string("varchar")',
      db: "varchar",
    });
  });

  it('maps integer to s.number("integer")', () => {
    expect(getColumnType("integer")).toEqual({
      schema: 's.number("integer")',
      db: "integer",
    });
  });

  it('maps int to s.number("integer")', () => {
    expect(getColumnType("int")).toEqual({
      schema: 's.number("integer")',
      db: "integer",
    });
  });

  it('maps bigint to s.number("bigint")', () => {
    expect(getColumnType("bigint")).toEqual({
      schema: 's.number("bigint")',
      db: "bigint",
    });
  });

  it("maps boolean to s.boolean()", () => {
    expect(getColumnType("boolean")).toEqual({
      schema: "s.boolean()",
      db: "boolean",
    });
  });

  it("maps bool to s.boolean()", () => {
    expect(getColumnType("bool")).toEqual({
      schema: "s.boolean()",
      db: "boolean",
    });
  });

  it('maps jsonb to s.unknown("jsonb")', () => {
    expect(getColumnType("jsonb")).toEqual({
      schema: 's.unknown("jsonb")',
      db: "jsonb",
    });
  });

  it('maps json to s.unknown("json")', () => {
    expect(getColumnType("json")).toEqual({
      schema: 's.unknown("json")',
      db: "json",
    });
  });

  it('maps timestamp to s.string("timestamp")', () => {
    expect(getColumnType("timestamp")).toEqual({
      schema: 's.string("timestamp")',
      db: "timestamp",
    });
  });

  it('maps timestamptz to s.string("timestamptz")', () => {
    expect(getColumnType("timestamptz")).toEqual({
      schema: 's.string("timestamptz")',
      db: "timestamptz",
    });
  });

  it('maps date to s.string("date")', () => {
    expect(getColumnType("date")).toEqual({
      schema: 's.string("date")',
      db: "date",
    });
  });

  it('maps numeric to s.number("numeric")', () => {
    expect(getColumnType("numeric")).toEqual({
      schema: 's.number("numeric")',
      db: "numeric",
    });
  });

  it('maps real to s.number("real")', () => {
    expect(getColumnType("real")).toEqual({
      schema: 's.number("real")',
      db: "real",
    });
  });

  it('maps double precision to s.number("float8")', () => {
    expect(getColumnType("double precision")).toEqual({
      schema: 's.number("float8")',
      db: "double precision",
    });
  });

  it('maps unknown type to s.unknown("unknown")', () => {
    expect(getColumnType("foobar_type")).toEqual({
      schema: 's.unknown("unknown")',
      db: "unknown",
    });
  });

  it("maps array type by wrapping base type", () => {
    expect(getColumnType("text[]")).toEqual({
      schema: 's.array(s.string("text"))',
      db: "text[]",
    });
  });

  it("maps integer[] array type", () => {
    expect(getColumnType("integer[]")).toEqual({
      schema: 's.array(s.number("integer"))',
      db: "integer[]",
    });
  });

  it("is case-insensitive", () => {
    expect(getColumnType("TEXT")).toEqual({
      schema: 's.string("text")',
      db: "text",
    });
    expect(getColumnType("INTEGER")).toEqual({
      schema: 's.number("integer")',
      db: "integer",
    });
  });

  it('maps inet to s.string("inet")', () => {
    expect(getColumnType("inet")).toEqual({
      schema: 's.string("inet")',
      db: "inet",
    });
  });

  it('maps point geometry to s.unknown("geometry")', () => {
    expect(getColumnType("point")).toEqual({
      schema: 's.unknown("geometry")',
      db: "geometry",
    });
  });

  it('maps serial to s.number("serial")', () => {
    expect(getColumnType("serial")).toEqual({
      schema: 's.number("serial")',
      db: "serial",
    });
  });

  it('maps smallint to s.number("smallint")', () => {
    expect(getColumnType("smallint")).toEqual({
      schema: 's.number("smallint")',
      db: "smallint",
    });
  });
});

describe("parseTables()", () => {
  const minimalSql = `
CREATE TABLE "public"."users" (
  "id" uuid NOT NULL,
  "name" text,
  "age" integer NOT NULL
);
`.trim();

  it("returns one table entry for a single CREATE TABLE", () => {
    const result = parseTables(minimalSql, {});
    expect(result).toHaveLength(1);
    expect(result[0].schema).toBe("public");
    expect(result[0].table).toBe("users");
  });

  it("parses column names correctly", () => {
    const result = parseTables(minimalSql, {});
    const names = result[0].columns.map((c) => c.name);
    expect(names).toEqual(["id", "name", "age"]);
  });

  it("wraps with s.nullable() for columns without NOT NULL", () => {
    const result = parseTables(minimalSql, {});
    const nameCol = result[0].columns.find((c) => c.name === "name");
    expect(nameCol?.schemaType).toContain("s.nullable(");
  });

  it("skips CONSTRAINT, PRIMARY KEY, FOREIGN KEY, UNIQUE lines", () => {
    const sql = `
CREATE TABLE "public"."orders" (
  "id" uuid NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE (id)
);
`.trim();
    const result = parseTables(sql, {});
    expect(result[0].columns).toHaveLength(1);
    expect(result[0].columns[0].name).toBe("id");
  });

  it("uses custom typings when a key matches schema.table.column", () => {
    const customTypings: Record<string, string> = {
      "public.users.id": "someCustomType",
    };
    const result = parseTables(minimalSql, customTypings);
    const id = result[0].columns.find((c) => c.name === "id");
    expect(id?.schemaType).toBe('typings["public.users.id"].type');
  });

  it("parses multiple tables", () => {
    const sql = `
CREATE TABLE "public"."users" (
  "id" uuid NOT NULL
);

CREATE TABLE "public"."posts" (
  "id" uuid NOT NULL,
  "title" text NOT NULL
);
`.trim();
    const result = parseTables(sql, {});
    expect(result).toHaveLength(2);
    expect(result[0].table).toBe("users");
    expect(result[1].table).toBe("posts");
  });

  it("returns empty array when no CREATE TABLE statements present", () => {
    expect(parseTables("SELECT 1;", {})).toEqual([]);
  });
});

describe("generateTypingsOutput()", () => {
  it("preserves the original table name without camelCase conversion", () => {
    const tables = [
      {
        schema: "public",
        table: "billing_event",
        columns: [
          { name: "id", schemaType: 's.string("uuid")', sqlType: "uuid" },
        ],
      },
    ];
    const output = generateTypingsOutput(tables);
    expect(output).toContain("billing_event:");
    expect(output).not.toContain("billingEvent:");
  });

  it("preserves the original schema name without camelCase conversion", () => {
    const tables = [
      {
        schema: "my_schema",
        table: "users",
        columns: [
          { name: "id", schemaType: 's.string("uuid")', sqlType: "uuid" },
        ],
      },
    ];
    const output = generateTypingsOutput(tables);
    expect(output).toContain("my_schema:");
    expect(output).not.toContain("mySchema:");
  });
});

describe("buildSchemaFromMigrations()", () => {
  it("returns SQL containing a CREATE TABLE for a simple migration", async () => {
    const migrationSql = [
      "-- migrate:up",
      'CREATE TABLE "public"."users" ("id" uuid NOT NULL);',
      "-- migrate:down",
      'DROP TABLE "public"."users";',
    ].join("\n");

    let tmpDir: string;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "damian-worker-test-"));
    fs.writeFileSync(
      path.join(tmpDir, "20240101000000_users.sql"),
      migrationSql,
    );

    try {
      const result = await buildSchemaFromMigrations(tmpDir, [
        "20240101000000_users.sql",
      ]);
      expect(result).toContain("users");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("readTypings()", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "damian-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty object when file does not exist", async () => {
    const result = await readTypings(path.join(tmpDir, "typings.ts"));
    expect(result).toEqual({});
  });

  it("returns empty object when file exports no default", async () => {
    const typingsFile = path.join(tmpDir, "typings.ts");
    fs.writeFileSync(typingsFile, "export const x = 1;");
    const result = await readTypings(typingsFile);
    expect(result).toEqual({});
  });

  it("reads a single schema.table.column key from a real typings export", async () => {
    const typingsFile = path.join(tmpDir, "typings.ts");
    fs.writeFileSync(
      typingsFile,
      [
        "export default {",
        "  public: {",
        "    users: {",
        "      role: { '~standard': { version: 1, vendor: 'test', validate: () => ({ value: 'x' }) } },",
        "    },",
        "  },",
        "};",
      ].join("\n"),
    );
    const result = await readTypings(typingsFile);
    expect(result["public.users.role"]).toBe("custom");
  });

  it("reads all keys from a multi-schema export", async () => {
    const typingsFile = path.join(tmpDir, "typings.ts");
    fs.writeFileSync(
      typingsFile,
      [
        "export default {",
        "  billing: {",
        "    billingEvent: {",
        "      kind: { '~standard': { version: 1, vendor: 'test', validate: () => ({ value: 'x' }) } },",
        "    },",
        "  },",
        "  public: {",
        "    users: {",
        "      role: { '~standard': { version: 1, vendor: 'test', validate: () => ({ value: 'x' }) } },",
        "    },",
        "  },",
        "};",
      ].join("\n"),
    );
    const result = await readTypings(typingsFile);
    expect(result["billing.billingEvent.kind"]).toBe("custom");
    expect(result["public.users.role"]).toBe("custom");
  });
});
