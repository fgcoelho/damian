import { describe, expect } from "vitest";
import { SLONIK_FRAGMENT } from "../../src/lib/utils";
import { it } from "../__shared__/it";
import { sql } from "../__shared__/sql";

describe("sql tag — template literal", () => {
  it()
    .should("produce a fragment with sql and values")
    .test(() => {
      const val = 42;
      const frag = sql`SELECT ${val}`;
      expect(typeof frag.sql).toBe("string");
      expect(frag.values).toContain(val);
      expect(frag.type).toBe(SLONIK_FRAGMENT);
    });

  it()
    .should("be usable as a SqlFragmentToken inside sql.join")
    .test(() => {
      const a = sql`a = ${1}`;
      const b = sql`b = ${2}`;
      const joined = sql.join([a, b], sql` OR `);
      expect(joined.members).toHaveLength(2);
    });
});
