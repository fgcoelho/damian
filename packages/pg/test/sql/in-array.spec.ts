import { describe, expect } from "vitest";
import { it } from "../__shared__/it";
import { sql } from "../__shared__/sql";

describe("sql.inArray", () => {
  it()
    .should("produce IN(...) fragment")
    .test(() => {
      const frag = sql.inArray(sql.identifier(["id"]), [1, 2, 3]);
      expect(frag.sql).toContain("IN");
    });

  it()
    .should("return FALSE fragment when values array is empty")
    .test(() => {
      const frag = sql.inArray(sql.identifier(["id"]), []);
      expect(frag.sql).toBe("FALSE");
    });

  it()
    .should("filter out undefined values")
    .test(() => {
      const frag = sql.inArray(sql.identifier(["id"]), [1, undefined, 3]);
      expect(frag.sql).toContain("IN");
      expect(frag.values.length).toBe(2);
    });
});
