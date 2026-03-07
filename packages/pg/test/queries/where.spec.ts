import { afterAll, beforeAll, describe, expect } from "vitest";
import { s } from "../../src/index";
import { table } from "../../src/table";
import { createTestPool } from "../__shared__/database";
import { it } from "../__shared__/it";
import { sql } from "../__shared__/sql";

const UserTable = table("public", "users", {
  id: s.number("int4"),
  name: s.string("text"),
  email: s.string("text"),
});

let db: Awaited<ReturnType<typeof createTestPool>>;

beforeAll(async () => {
  db = await createTestPool();
  await db.query(sql.void`
    CREATE TABLE users (
      id    serial PRIMARY KEY,
      name  text NOT NULL,
      email text NOT NULL UNIQUE
    )
  `);
  await db.query(
    sql.void`INSERT INTO users (id, name, email) VALUES
      (1, 'Alice', 'a@x.com'),
      (2, 'Bob',   'b@x.com'),
      (3, 'Carol', 'c@x.com')`,
  );
});

afterAll(async () => {
  await db.end();
});

describe("WHERE", () => {
  it()
    .should("filter rows by column equality")
    .test(async () => {
      const result = await db.query(
        sql(
          UserTable,
        )`SELECT * FROM ${UserTable} WHERE ${UserTable.name} = ${"Alice"}`,
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe("Alice");
    });

  it()
    .should("filter rows by id list with sql.inArray")
    .test(async () => {
      const result = await db.query(
        sql(
          UserTable,
        )`SELECT * FROM ${UserTable} WHERE ${sql.inArray(UserTable.id, [1, 3])}`,
      );
      expect(result.rows).toHaveLength(2);
      expect(result.rows.map((r) => r.name).sort()).toEqual(["Alice", "Carol"]);
    });

  it()
    .should("return no rows when sql.inArray list is empty")
    .test(async () => {
      const result = await db.query(
        sql(
          UserTable,
        )`SELECT * FROM ${UserTable} WHERE ${sql.inArray(UserTable.id, [])}`,
      );
      expect(result.rows).toHaveLength(0);
    });

  it()
    .should('match all rows when sql.identity("and") is used as TRUE')
    .test(async () => {
      const result = await db.query(
        sql(UserTable)`SELECT * FROM ${UserTable} WHERE ${sql.identity("and")}`,
      );
      expect(result.rows).toHaveLength(3);
    });

  it()
    .should('match no rows when sql.identity("or") is used as FALSE')
    .test(async () => {
      const result = await db.query(
        sql(UserTable)`SELECT * FROM ${UserTable} WHERE ${sql.identity("or")}`,
      );
      expect(result.rows).toHaveLength(0);
    });

  it()
    .should('use sql.identity("or") as a no-op fallback in sql.join.or')
    .test(async () => {
      const filterEmail: string | undefined = undefined;
      const result = await db.query(
        sql(UserTable)`
          SELECT * FROM ${UserTable}
          WHERE ${sql.join.or(
            filterEmail
              ? sql`${UserTable.email} = ${filterEmail}`
              : sql.identity("or"),
          )}
        `,
      );
      expect(result.rows).toHaveLength(0);
    });

  it()
    .should("filter by column when a value is provided via sql.join.or")
    .test(async () => {
      const filterEmail: string | undefined = "a@x.com";
      const result = await db.query(
        sql(UserTable)`
          SELECT * FROM ${UserTable}
          WHERE ${sql.join.or(
            filterEmail
              ? sql`${UserTable.email} = ${filterEmail}`
              : sql.identity("or"),
          )}
        `,
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe("Alice");
    });
});
