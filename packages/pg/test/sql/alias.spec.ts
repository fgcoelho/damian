import { describe, expect } from "vitest";
import { s } from "../../src/index";
import { table } from "../../src/table";
import { it } from "../__shared__/it";
import { sql } from "../__shared__/sql";

describe("sql.alias", () => {
  const t = table("public", "orders", { id: s.string("text") });

  it()
    .should("throw when alias equals table name")
    .test(() => {
      const users = table("public", "users", { id: s.string("text") });
      expect(() => sql.alias(users, "users")).toThrow();
    });

  it()
    .should("rename the table name and sql fragment")
    .test(() => {
      const aliased = sql.alias(t, "o");
      expect(aliased.tableName).toBe("o");
      expect(aliased.sql).toContain('"o"');
    });
});
