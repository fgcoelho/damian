import { describe, expect } from "vitest";
import { s } from "../../src";
import { it } from "../__shared__/it";
import { sql } from "../__shared__/sql";

describe("sql(schema)", () => {
  it()
    .should("return a typed query factory when given a standard schema")
    .test(() => {
      const schema = s.object({ id: s.number("int4") });
      const factory = sql(schema);
      expect(typeof factory).toBe("function");
    });

  it()
    .should("produce a tagged query with sql string from schema")
    .test(() => {
      const schema = s.object({ count: s.number("int4") });
      const query = sql(schema)`SELECT 1 AS count`;
      expect(typeof query.sql).toBe("string");
    });

  it()
    .should(
      "return a typed query factory when given a record of standard schemas",
    )
    .test(() => {
      const userSchema = s.object({ id: s.string("uuid") });
      const postSchema = s.object({ title: s.string("text") });
      const factory = sql({ user: userSchema, post: postSchema });
      expect(typeof factory).toBe("function");
    });

  it()
    .should("produce a tagged query with sql string from record of schemas")
    .test(() => {
      const userSchema = s.object({ id: s.string("uuid") });
      const postSchema = s.object({ title: s.string("text") });
      const query = sql({ user: userSchema, post: postSchema })`SELECT 1`;
      expect(typeof query.sql).toBe("string");
    });
});
