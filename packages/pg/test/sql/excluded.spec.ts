import { describe, expect } from "vitest";
import { it } from "../__shared__/it";
import { sql } from "../__shared__/sql";

describe("sql.excluded", () => {
  it()
    .should("generate SET col = EXCLUDED.col pairs")
    .test(() => {
      const cols = [sql.identifier(["a"]), sql.identifier(["b"])];
      const frag = sql.excluded(cols);
      expect(frag.sql).toContain('"a" = EXCLUDED."a"');
      expect(frag.sql).toContain('"b" = EXCLUDED."b"');
    });

  it()
    .should("ignore specified columns")
    .test(() => {
      const cols = [sql.identifier(["a"]), sql.identifier(["b"])];
      const frag = sql.excluded(cols, [sql.identifier(["b"])]);
      expect(frag.sql).not.toContain('"b"');
    });
});
