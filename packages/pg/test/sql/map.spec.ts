import type { FragmentSqlToken } from "slonik";
import { describe, expect, expectTypeOf } from "vitest";
import { it } from "../__shared__/it";
import { sql } from "../__shared__/sql";

describe("sql.map", () => {
  it()
    .should("map an array with a callback that ignores index")
    .test(() => {
      const rows = [
        [1, 2],
        [3, 4],
      ];
      const result = sql.map(rows, sql.tuple);
      expect(result).toHaveLength(2);
      expect(result[0].sql).toMatch(/\(/);
    });

  it()
    .should("map an array with a callback that uses index")
    .test(() => {
      const items = ["a", "b"];
      const result = sql.map(
        items,
        (item: string, index: number) => sql`${item}::text -- ${index}`,
      );
      expect(result).toHaveLength(2);
    });

  it()
    .should("accept a callback without index param without type errors")
    .test(() => {
      const rows: number[][] = [[1], [2]];
      const result = sql.map(rows, sql.tuple);
      expectTypeOf(result).toMatchTypeOf<FragmentSqlToken[]>();
    });
});
