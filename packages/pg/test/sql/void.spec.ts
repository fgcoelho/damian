import { describe, expect } from "vitest";
import { it } from "../__shared__/it";
import { sql } from "../__shared__/sql";

describe("sql.void", () => {
  it()
    .should("produce a query tagged with void schema")
    .test(() => {
      const query = sql.void`SELECT 1`;

      expect(typeof query.sql).toBe("string");
    });
});
