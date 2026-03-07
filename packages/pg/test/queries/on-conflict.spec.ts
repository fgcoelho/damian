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
});

afterAll(async () => {
  await db.end();
});

describe("ON CONFLICT", () => {
  it()
    .should(
      "update the existing row on conflict via DO UPDATE SET sql.excluded",
    )
    .test(async () => {
      const { cols, rows } = UserTable.createRows([
        { id: 1, name: "Alice", email: "alice1@example.com" },
      ]);

      await db.query(
        sql.void`INSERT INTO users ${sql.tuple(cols)} VALUES ${sql.tuples(rows)}`,
      );

      const { cols: updateCols, rows: updateRows } = UserTable.createRows([
        { id: 1, name: "Alice Updated", email: "alice1@example.com" },
      ]);

      await db.query(sql.void`
        INSERT INTO users ${sql.tuple(updateCols)}
        VALUES ${sql.tuples(updateRows)}
        ON CONFLICT (email) DO UPDATE
        SET ${sql.excluded(updateCols, [UserTable.id])}
      `);

      const result = await db.query(
        sql(
          UserTable,
        )`SELECT * FROM users WHERE email = ${"alice1@example.com"}`,
      );
      
      expect(result.rows[0].name).toBe("Alice Updated");
    });

  it()
    .should("leave the existing row unchanged on conflict via DO NOTHING")
    .test(async () => {
      const { cols, rows } = UserTable.createRows([
        { id: 2, name: "Bob", email: "bob@example.com" },
      ]);
      await db.query(
        sql.void`INSERT INTO users ${sql.tuple(cols)} VALUES ${sql.tuples(rows)}`,
      );
      const { cols: nothingCols, rows: nothingRows } = UserTable.createRows([
        { id: 3, name: "Bob Duplicate", email: "bob@example.com" },
      ]);
      await db.query(sql.void`
        INSERT INTO users ${sql.tuple(nothingCols)}
        VALUES ${sql.tuples(nothingRows)}
        ON CONFLICT (email) DO NOTHING
      `);
      const result = await db.query(
        sql(UserTable)`SELECT * FROM users WHERE email = ${"bob@example.com"}`,
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe("Bob");
    });
});
