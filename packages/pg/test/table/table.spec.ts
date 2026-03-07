import { describe, expect } from "vitest";
import { s, table } from "../../src/index";
import { SLONIK_FRAGMENT } from "../../src/lib/utils";
import { it } from "../__shared__/it";
import { sql } from "../__shared__/sql";

const users = table("public", "users", {
  id: s.string("uuid"),
  name: s.string("text"),
  age: s.optional(s.number("int4")),
});

describe("table", () => {
  it()
    .should("expose tableName and tableSchema")
    .test(() => {
      expect(users.tableName).toBe("users");
      expect(users.tableSchema).toBe("public");
    });

  it()
    .should("expose table-qualified column identifiers")
    .test(() => {
      expect(users.id.names).toEqual(["users", "id"]);
      expect(users.name.names).toEqual(["users", "name"]);
    });

  it()
    .should("expose cols as unqualified identifiers")
    .test(() => {
      const colNames = users.cols.map((c) => c.names[0]);
      expect(colNames).toEqual(["id", "name", "age"]);
    });

  it()
    .should('have sql string as "schema.table" quoted')
    .test(() => {
      expect(users.sql).toBe('"public"."users"');
    });

  it()
    .should("have empty values (used as fragment)")
    .test(() => {
      expect(users.values).toEqual([]);
    });

  it()
    .should("have type SLONIK_FRAGMENT")
    .test(() => {
      expect(users.type).toBe(SLONIK_FRAGMENT);
    });

  it()
    .should("have types reflecting zod description values")
    .test(() => {
      expect(users.types).toEqual(["uuid", "text", "int4"]);
    });

  it()
    .should("have a standard schema object")
    .test(() => {
      expect(users.schema["~standard"]).toBeDefined();
      expect(users.schema["~standard"].version).toBe(1);
      expect(typeof users.schema["~standard"].validate).toBe("function");
    });

  it()
    .should(
      "expose each column as a StandardSchemaV1-compatible field in schema.cols",
    )
    .test(() => {
      expect(users.schema.cols.id["~standard"]).toBeDefined();
      expect(users.schema.cols.name["~standard"]).toBeDefined();
      expect(users.schema.cols.age["~standard"]).toBeDefined();
    });

  it()
    .should("validate values matching the column type in schema.cols column")
    .test(() => {
      const result = users.schema.cols.id["~standard"].validate("some-uuid");
      expect("value" in result && result.value).toBe("some-uuid");
    });

  it()
    .should("reject values not matching the column type in schema.cols column")
    .test(() => {
      const result = users.schema.cols.id["~standard"].validate(42);
      expect("issues" in result).toBe(true);
    });

  it()
    .should("interpolate the table in a sql template as its sql string")
    .test(() => {
      const frag = sql`SELECT * FROM ${users}`;

      expect(frag.sql).toContain('"public"."users"');
    });
});
