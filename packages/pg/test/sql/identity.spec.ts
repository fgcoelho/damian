import { describe, expect } from "vitest";
import { it } from "../__shared__/it";
import { sql } from "../__shared__/sql";

describe("sql.identity", () => {
  it()
    .should("return TRUE for 'and' context")
    .test(() => {
      const frag = sql.identity("and");
      expect(frag.sql).toBe("TRUE");
    });

  it()
    .should("return FALSE for 'or' context")
    .test(() => {
      const frag = sql.identity("or");
      expect(frag.sql).toBe("FALSE");
    });
});
