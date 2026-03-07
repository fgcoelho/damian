import { describe, expect } from "vitest";
import { s, table } from "../../src/index";
import { it } from "../__shared__/it";

const users = table("public", "users", {
  id: s.string("uuid"),
  name: s.string("text"),
  age: s.optional(s.number("int4")),
});

const withArray = table("public", "tags", {
  id: s.string("uuid"),
  labels: s.array(s.string("text"), "text[]"),
});

describe("table.createRow", () => {
  it()
    .should("extract cols and row from a full record")
    .test(() => {
      const { cols, row } = users.createRow({
        id: "abc",
        name: "Alice",
        age: 30,
      });

      expect(cols.map((c) => c.names[0])).toEqual(["id", "name", "age"]);

      expect(row).toEqual(["abc", "Alice", 30]);
    });

  it()
    .should("only include defined keys for partial rows")
    .test(() => {
      const { cols, row } = users.createPartialRow({ id: "abc" });

      expect(cols.map((c) => c.names[0])).toEqual(["id"]);

      expect(row).toEqual(["abc"]);
    });

  it()
    .should("convert null/undefined cells to null")
    .test(() => {
      const { row } = users.createPartialRow({ id: "abc", age: undefined });

      expect(row).not.toContain(undefined);
    });

  it()
    .should("convert non-empty array to postgres array literal")
    .test(() => {
      const { row } = withArray.createRow({ id: "x", labels: ["a", "b"] });

      expect(row[1]).toBe("{a,b}");
    });

  it()
    .should("convert empty array to empty postgres array literal")
    .test(() => {
      const { row } = withArray.createRow({ id: "x", labels: [] });

      expect(row[1]).toBe("{}");
    });
});

describe("table.createRows", () => {
  it()
    .should("extract shared cols across multiple records")
    .test(() => {
      const { cols, rows } = users.createRows([
        { id: "a", name: "Alice", age: 10 },
        { id: "b", name: "Bob", age: 20 },
      ]);

      expect(cols.map((c) => c.names[0])).toEqual(["id", "name", "age"]);

      expect(rows).toHaveLength(2);
    });

  it()
    .should("include a column if any record defines it")
    .test(() => {
      const { cols } = users.createPartialRows([
        { id: "a" },
        { id: "b", name: "Bob" },
      ]);

      const names = cols.map((c) => c.names[0]);

      expect(names).toContain("name");
    });
});
