import { describe, expect } from "vitest";
import { it } from "../__shared__/it";
import { sql } from "../__shared__/sql";

describe("sql.join", () => {
  it()
    .should("join fragments with a custom separator")
    .test(() => {
      const a = sql`a = ${1}`;
      const b = sql`b = ${2}`;
      const result = sql.join([a, b], sql` OR `);
      expect(result.members).toHaveLength(2);
    });

  it()
    .should("accept an array via .comma")
    .test(() => {
      const frags = [sql`a`, sql`b`, sql`c`];
      const result = sql.join.comma(frags);
      expect(result.members).toHaveLength(3);
    });

  it()
    .should("accept spread args via .comma")
    .test(() => {
      const result = sql.join.comma(sql`a`, sql`b`);
      expect(result.members).toHaveLength(2);
    });

  it()
    .should("accept spread args via .and")
    .test(() => {
      const result = sql.join.and(sql`x = ${1}`, sql`y = ${2}`);
      expect(result.members).toHaveLength(2);
    });

  it()
    .should("accept spread args via .or")
    .test(() => {
      const result = sql.join.or(sql`x = ${1}`, sql`y = ${2}`);
      expect(result.members).toHaveLength(2);
    });

  it()
    .should("filter undefined values from an array via .comma")
    .test(() => {
      const result = sql.join.comma([sql`a`, undefined, sql`b`]);
      expect(result.members).toHaveLength(2);
    });

  it()
    .should("filter undefined values from spread args via .and")
    .test(() => {
      const result = sql.join.and(sql`x = ${1}`, undefined, sql`y = ${2}`);
      expect(result.members).toHaveLength(2);
    });

  it()
    .should("filter undefined values from spread args via .or")
    .test(() => {
      const result = sql.join.or(sql`x = ${1}`, undefined, sql`y = ${2}`);
      expect(result.members).toHaveLength(2);
    });
});
