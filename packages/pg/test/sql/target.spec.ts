import { describe, expect } from "vitest";
import { it } from "../__shared__/it";
import { sql } from "../__shared__/sql";

describe("sql.target / sql.targets", () => {
  it()
    .should("strip table prefix from identifier via target")
    .test(() => {
      const col = sql.identifier(["users", "id"]);

      const t = sql.target(col);

      expect(t.names).toEqual(["id"]);
    });

  it()
    .should("map multiple identifiers via targets")
    .test(() => {
      const cols = [
        sql.identifier(["users", "id"]),
        sql.identifier(["users", "name"]),
      ];

      const targets = sql.targets(cols);

      expect(targets.map((t) => t.names[0])).toEqual(["id", "name"]);
    });
});
