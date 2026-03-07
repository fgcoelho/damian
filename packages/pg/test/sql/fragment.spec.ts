import { describe, expect } from "vitest";
import { SLONIK_FRAGMENT } from "../../src/lib/utils";
import { it } from "../__shared__/it";
import { sql } from "../__shared__/sql";

describe("sql.fragment", () => {
  it()
    .should("produce a reusable sql fragment")
    .test(() => {
      const frag = sql.fragment`WHERE id = ${1}`;

      expect(frag.type).toBe(SLONIK_FRAGMENT);
      expect(typeof frag.sql).toBe("string");
    });
});
