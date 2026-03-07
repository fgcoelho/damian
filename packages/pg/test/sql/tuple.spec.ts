import { describe, expect } from "vitest";
import { it } from "../__shared__/it";
import { sql } from "../__shared__/sql";

describe("sql.tuple", () => {
  it()
    .should("produce a parenthesized fragment via tuple")
    .test(() => {
      const frag = sql.tuple(1, 2, 3);
      expect(frag.sql).toMatch(/\(/);
    });
});

describe("sql.tuples", () => {
  it()
    .should("produce comma-joined tuple fragments via tuples")
    .test(() => {
      const frag = sql.tuples([
        [1, 2],
        [3, 4],
      ]);
      expect(frag.sql).toContain("(");
    });

  it()
    .should("throw when all rows are empty after filtering via tuples")
    .test(() => {
      expect(() => sql.tuples([[undefined, undefined]])).toThrow();
    });
});
