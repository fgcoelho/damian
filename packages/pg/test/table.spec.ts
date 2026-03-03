import { describe, expect, it } from "vitest";
import { s, sql, table } from "../src/index.js";
import { SLONIK_FRAGMENT } from "../src/utils.js";

const users = table("public", "users", {
  id: s.string("uuid"),
  name: s.string("text"),
  age: s.optional(s.number("int4")),
});

describe("table()", () => {
  it("exposes tableName and tableSchema", () => {
    expect(users.tableName).toBe("users");
    expect(users.tableSchema).toBe("public");
  });

  it("exposes table-qualified column identifiers", () => {
    expect(users.id.names).toEqual(["users", "id"]);
    expect(users.name.names).toEqual(["users", "name"]);
  });

  it("exposes cols as unqualified identifiers", () => {
    const colNames = users.cols.map((c) => c.names[0]);
    expect(colNames).toEqual(["id", "name", "age"]);
  });

  it("sql string is schema.table quoted", () => {
    expect(users.sql).toBe('"public"."users"');
  });

  it("values is empty (used as fragment)", () => {
    expect(users.values).toEqual([]);
  });

  it("type is SLONIK_FRAGMENT", () => {
    expect(users.type).toBe(SLONIK_FRAGMENT);
  });

  it("types reflects zod description values", () => {
    expect(users.types).toEqual(["uuid", "text", "int4"]);
  });

  it("schema is a standard schema object", () => {
    expect(users.schema["~standard"]).toBeDefined();
    expect(users.schema["~standard"].version).toBe(1);
    expect(typeof users.schema["~standard"].validate).toBe("function");
  });
});

describe("table.createRow()", () => {
  it("extracts cols and row from a full record", () => {
    const { cols, row } = users.createRow({
      id: "abc",
      name: "Alice",
      age: 30,
    });
    expect(cols.map((c) => c.names[0])).toEqual(["id", "name", "age"]);
    expect(row).toEqual(["abc", "Alice", 30]);
  });

  it("only includes defined keys for partial rows", () => {
    const { cols, row } = users.createPartialRow({ id: "abc" });
    expect(cols.map((c) => c.names[0])).toEqual(["id"]);
    expect(row).toEqual(["abc"]);
  });

  it("converts null/undefined cells to null", () => {
    const { row } = users.createPartialRow({ id: "abc", age: undefined });
    expect(row).not.toContain(undefined);
  });
});

describe("table.createRows()", () => {
  it("extracts shared cols across multiple records", () => {
    const { cols, rows } = users.createRows([
      { id: "a", name: "Alice", age: 10 },
      { id: "b", name: "Bob", age: 20 },
    ]);
    expect(cols.map((c) => c.names[0])).toEqual(["id", "name", "age"]);
    expect(rows).toHaveLength(2);
  });

  it("includes a column if any record defines it", () => {
    const { cols } = users.createPartialRows([
      { id: "a" },
      { id: "b", name: "Bob" },
    ]);
    const names = cols.map((c) => c.names[0]);
    expect(names).toContain("name");
  });
});

describe("table — array/object cell conversion", () => {
  const withArray = table("public", "tags", {
    id: s.string("uuid"),
    labels: s.array(s.string("text"), "text[]"),
  });

  it("converts non-empty array to postgres array literal", () => {
    const { row } = withArray.createRow({ id: "x", labels: ["a", "b"] });
    expect(row[1]).toBe("{a,b}");
  });

  it("converts empty array to empty postgres array literal", () => {
    const { row } = withArray.createRow({ id: "x", labels: [] });
    expect(row[1]).toBe("{}");
  });
});

describe("table — can be used as sql fragment interpolation", () => {
  it("interpolates the table in a sql template as its sql string", () => {
    const frag = sql`SELECT * FROM ${users}`;
    expect(frag.sql).toContain('"public"."users"');
  });
});
