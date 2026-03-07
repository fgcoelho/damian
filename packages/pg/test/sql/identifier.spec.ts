import { describe, expect } from "vitest";
import { it } from "../__shared__/it";
import { sql } from "../__shared__/sql";

describe("sql.identifier", () => {
  it()
    .should("produce an identifier token")
    .test(() => {
      const id = sql.identifier(["public", "users"]);
      expect(id.names).toEqual(["public", "users"]);
    });
});
