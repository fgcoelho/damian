import type { FragmentSqlToken } from "slonik";
import { describe, expect, expectTypeOf, it } from "vitest";
import { type SelectBuilder, s } from "../src/index.js";
import { internalSQL as sql } from "../src/sql.js";
import { table } from "../src/table.js";
import { SLONIK_FRAGMENT } from "../src/utils.js";
import { createTestPool } from "./__shared__/pglite-database.js";

describe("sql tag — template literal", () => {
  it("produces a fragment with sql and values", () => {
    const val = 42;
    const frag = sql`SELECT ${val}`;
    expect(typeof frag.sql).toBe("string");
    expect(frag.values).toContain(val);
    expect(frag.type).toBe(SLONIK_FRAGMENT);
  });

  it("is usable as a SqlFragmentToken inside sql.join", () => {
    const a = sql`a = ${1}`;
    const b = sql`b = ${2}`;
    const joined = sql.join([a, b], sql` OR `);
    expect(joined.members).toHaveLength(2);
  });
});

describe("sql.identifier", () => {
  it("produces an identifier token", () => {
    const id = sql.identifier(["public", "users"]);
    expect(id.names).toEqual(["public", "users"]);
  });
});

describe("sql.fragment", () => {
  it("produces a reusable sql fragment", () => {
    const frag = sql.fragment`WHERE id = ${1}`;
    expect(frag.type).toBe(SLONIK_FRAGMENT);
    expect(typeof frag.sql).toBe("string");
  });
});

describe("sql.void", () => {
  it("produces a query tagged with void schema", () => {
    const query = sql.void`SELECT 1`;
    expect(typeof query.sql).toBe("string");
  });
});

describe("sql(schema)", () => {
  it("returns a typed query factory when given a standard schema", () => {
    const schema = s.object({ id: s.number("int4") });
    const factory = sql(schema);
    expect(typeof factory).toBe("function");
  });

  it("tagged query from schema has sql string", () => {
    const schema = s.object({ count: s.number("int4") });
    const query = sql(schema)`SELECT 1 AS count`;
    expect(typeof query.sql).toBe("string");
  });

  it("returns a typed query factory when given a record of standard schemas", () => {
    const userSchema = s.object({ id: s.string("uuid") });
    const postSchema = s.object({ title: s.string("text") });
    const factory = sql({ user: userSchema, post: postSchema });
    expect(typeof factory).toBe("function");
  });

  it("tagged query from record of schemas has sql string", () => {
    const userSchema = s.object({ id: s.string("uuid") });
    const postSchema = s.object({ title: s.string("text") });
    const query = sql({ user: userSchema, post: postSchema })`SELECT 1`;
    expect(typeof query.sql).toBe("string");
  });
});

describe("sql.map", () => {
  it("maps an array with a callback that ignores index", () => {
    const rows = [
      [1, 2],
      [3, 4],
    ];
    const result = sql.map(rows, sql.tuple);
    expect(result).toHaveLength(2);
    expect(result[0].sql).toMatch(/\(/);
  });

  it("maps an array with a callback that uses index", () => {
    const items = ["a", "b"];
    const result = sql.map(
      items,
      (item: string, index: number) => sql`${item}::text -- ${index}`,
    );
    expect(result).toHaveLength(2);
  });

  it("type: callback without index param is accepted without error", () => {
    const rows: number[][] = [[1], [2]];
    const result = sql.map(rows, sql.tuple);
    expectTypeOf(result).toMatchTypeOf<FragmentSqlToken[]>();
  });
});

describe("sql.join", () => {
  it("joins fragments with a custom separator", () => {
    const a = sql`a = ${1}`;
    const b = sql`b = ${2}`;
    const result = sql.join([a, b], sql` OR `);
    expect(result.members).toHaveLength(2);
  });

  it(".comma accepts an array", () => {
    const frags = [sql`a`, sql`b`, sql`c`];
    const result = sql.join.comma(frags);
    expect(result.members).toHaveLength(3);
  });

  it(".comma accepts spread args", () => {
    const result = sql.join.comma(sql`a`, sql`b`);
    expect(result.members).toHaveLength(2);
  });

  it(".and accepts spread args", () => {
    const result = sql.join.and(sql`x = ${1}`, sql`y = ${2}`);
    expect(result.members).toHaveLength(2);
  });

  it(".or accepts spread args", () => {
    const result = sql.join.or(sql`x = ${1}`, sql`y = ${2}`);
    expect(result.members).toHaveLength(2);
  });

  it(".comma filters undefined values from an array", () => {
    const result = sql.join.comma([sql`a`, undefined, sql`b`]);
    expect(result.members).toHaveLength(2);
  });

  it(".and filters undefined values from spread args", () => {
    const result = sql.join.and(sql`x = ${1}`, undefined, sql`y = ${2}`);
    expect(result.members).toHaveLength(2);
  });

  it(".or filters undefined values from spread args", () => {
    const result = sql.join.or(sql`x = ${1}`, undefined, sql`y = ${2}`);
    expect(result.members).toHaveLength(2);
  });
});

describe("sql.alias", () => {
  const t = table("public", "orders", { id: s.string("text") });

  it("throws when alias equals table name", () => {
    const users = table("public", "users", { id: s.string("text") });
    expect(() => sql.alias(users, "users")).toThrow();
  });

  it("renames the table name and sql fragment", () => {
    const aliased = sql.alias(t, "o");
    expect(aliased.tableName).toBe("o");
    expect(aliased.sql).toContain('"o"');
  });
});

describe("sql.inArray", () => {
  it("produces IN(...) fragment", () => {
    const frag = sql.inArray(sql.identifier(["id"]), [1, 2, 3]);
    expect(frag.sql).toContain("IN");
  });

  it("returns FALSE fragment when values array is empty", () => {
    const frag = sql.inArray(sql.identifier(["id"]), []);
    expect(frag.sql).toBe("FALSE");
  });

  it("filters out undefined values", () => {
    const frag = sql.inArray(sql.identifier(["id"]), [1, undefined, 3]);
    expect(frag.sql).toContain("IN");
    expect(frag.values.length).toBe(2);
  });
});

describe("sql.target / sql.targets", () => {
  it("target strips table prefix from identifier", () => {
    const col = sql.identifier(["users", "id"]);
    const t = sql.target(col);
    expect(t.names).toEqual(["id"]);
  });

  it("targets maps multiple identifiers", () => {
    const cols = [
      sql.identifier(["users", "id"]),
      sql.identifier(["users", "name"]),
    ];
    const targets = sql.targets(cols);
    expect(targets.map((t) => t.names[0])).toEqual(["id", "name"]);
  });
});

describe("sql.tuple / sql.tuples", () => {
  it("tuple produces a parenthesized fragment", () => {
    const frag = sql.tuple(1, 2, 3);
    expect(frag.sql).toMatch(/\(/);
  });

  it("tuples produces comma-joined tuple fragments", () => {
    const frag = sql.tuples([
      [1, 2],
      [3, 4],
    ]);
    expect(frag.sql).toContain("(");
  });

  it("tuples throws when all rows are empty after filtering", () => {
    expect(() => sql.tuples([[undefined, undefined]])).toThrow();
  });
});

describe("sql.identity", () => {
  it("returns TRUE for 'and' context", () => {
    const frag = sql.identity("and");
    expect(frag.sql).toBe("TRUE");
  });

  it("returns FALSE for 'or' context", () => {
    const frag = sql.identity("or");
    expect(frag.sql).toBe("FALSE");
  });
});

describe("sql.output", () => {
  const items = table("public", "items", {
    id: s.string("text"),
    name: s.string("text"),
  });

  it("accepts a table with a concrete schema type without type errors", () => {
    const concreteTable = table("public", "training_templates", {
      id: s.string("text"),
      routine_id: s.nullable(s.string("text")),
      created_at: s.string("text"),
      updated_at: s.string("text"),
    });

    expectTypeOf(sql.output).toBeCallableWith(concreteTable);
    const frag = sql.output(concreteTable);
    expectTypeOf(frag).toMatchTypeOf<SelectBuilder>();
  });

  it("produces wildcard select for a table", () => {
    const frag = sql.output(items);
    expect(frag.sql).toContain("items");
  });

  it("produces column select for an identifier", () => {
    const col = sql.identifier(["users", "name"]);
    const frag = sql.output(col);
    expect(typeof frag.sql).toBe("string");
  });

  it(".alias() changes the output alias", () => {
    const frag = sql.output(items).alias("renamed");
    expect(frag.sql).toContain('"renamed"');
  });

  it(".json() wraps in row_to_json", () => {
    const frag = sql.output(items).json();
    expect(frag.sql).toContain("row_to_json");
  });

  it(".array() wraps in array_agg", () => {
    const frag = sql.output(items).array();
    expect(frag.sql).toContain("array_agg");
  });

  it(".exclude() removes the specified column from selection", () => {
    const frag = sql.output(items).exclude(items.name);
    expect(frag.sql).not.toContain('"name"');
  });

  it(".exclude() throws when excluding a column from an identifier selection", () => {
    const col = sql.identifier(["users", "name"]);
    expect(() => sql.output(col).exclude(col)).toThrow();
  });
});

describe("sql.excluded", () => {
  it("generates SET col = EXCLUDED.col pairs", () => {
    const cols = [sql.identifier(["a"]), sql.identifier(["b"])];
    const frag = sql.excluded(cols);
    expect(frag.sql).toContain('"a" = EXCLUDED."a"');
    expect(frag.sql).toContain('"b" = EXCLUDED."b"');
  });

  it("ignores specified columns", () => {
    const cols = [sql.identifier(["a"]), sql.identifier(["b"])];
    const frag = sql.excluded(cols, [sql.identifier(["b"])]);
    expect(frag.sql).not.toContain('"b"');
  });
});

describe("sql — live query against PGlite", () => {
  it("executes a typed query and returns rows", async () => {
    const db = await createTestPool();
    const schema = s.object({ val: s.number("int4") });
    const result = await db.query(sql(schema)`SELECT 1::int AS val`);
    expect(result.rows[0].val).toBe(1);
    await db.end();
  });

  it("executes an untyped template literal query via db.query", async () => {
    const db = await createTestPool();
    await db.query(sql`SELECT 1`);
    await db.end();
  });
});
