import { describe, expect, expectTypeOf } from "vitest";
import { type SelectBuilder, s } from "../../src/index";
import { table } from "../../src/table";
import { it } from "../__shared__/it";
import { sql } from "../__shared__/sql";

describe("sql.output", () => {
  const items = table("public", "items", {
    id: s.string("text"),
    name: s.string("text"),
  });

  it()
    .should("accept a table with a concrete schema type without type errors")
    .test(() => {
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

  it()
    .should("produce wildcard select for a table")
    .test(() => {
      const frag = sql.output(items);
      expect(frag.sql).toContain("items");
    });

  it()
    .should("produce column select for an identifier")
    .test(() => {
      const col = sql.identifier(["users", "name"]);
      const frag = sql.output(col);
      expect(typeof frag.sql).toBe("string");
    });

  it()
    .should("change the output alias via .alias()")
    .test(() => {
      const frag = sql.output(items).alias("renamed");
      expect(frag.sql).toContain('"renamed"');
    });

  it()
    .should("wrap in row_to_json via .json()")
    .test(() => {
      const frag = sql.output(items).json();
      expect(frag.sql).toContain("row_to_json");
    });

  it()
    .should("not map string keys as parameters via .json().exclude()")
    .test(() => {
      const frag = sql.output(items).json().exclude(items.name);
      expect(frag.sql).toContain("'id'");
      expect(frag.sql).toContain('"id"');
      expect(frag.values).toEqual([]);
      expect(frag.sql).not.toContain('"name"');
    });

  it()
    .should("wrap in array_agg via .array()")
    .test(() => {
      const frag = sql.output(items).array();
      expect(frag.sql).toContain("array_agg");
    });

  it()
    .should("remove the specified column from selection via .exclude()")
    .test(() => {
      const frag = sql.output(items).exclude(items.name);
      expect(frag.sql).not.toContain('"name"');
    });

  it()
    .should(
      "throw when excluding a column from an identifier selection via .exclude()",
    )
    .test(() => {
      const col = sql.identifier(["users", "name"]);
      expect(() => sql.output(col).exclude(col)).toThrow();
    });
});
