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

const PostTable = table("public", "posts", {
  id: s.number("int4"),
  user_id: s.number("int4"),
  title: s.string("text"),
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
  await db.query(sql.void`
    CREATE TABLE posts (
      id      serial PRIMARY KEY,
      user_id int NOT NULL REFERENCES users(id),
      title   text NOT NULL
    )
  `);
  await db.query(
    sql.void`INSERT INTO users (id, name, email) VALUES
      (1, 'Alice', 'alice@example.com'),
      (2, 'Bob',   'bob@example.com')`,
  );
  await db.query(
    sql.void`INSERT INTO posts (user_id, title) VALUES
      (1, 'Post A'),
      (1, 'Post B')`,
  );
});

afterAll(async () => {
  await db.end();
});

describe("SELECT", () => {
  it()
    .should("return all rows with SELECT *")
    .test(async () => {
      const result = await db.query(sql(UserTable)`SELECT * FROM ${UserTable}`);

      expect(result.rows).toHaveLength(2);
    });

  it()
    .should("return a single matched row with SELECT * WHERE")
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
    .should("select all columns via sql.output(Table)")
    .test(async () => {
      const result = await db.query(
        sql(
          UserTable,
        )`SELECT ${sql.output(UserTable)} FROM ${UserTable} WHERE ${UserTable.id} = ${1}`,
      );
      expect(result.rows[0].name).toBe("Alice");
      expect(result.rows[0].email).toBe("alice@example.com");
    });

  it()
    .should("exclude a column with sql.output(Table).exclude(col)")
    .test(async () => {
      const NoEmailSchema = s.object({
        id: s.number("int4"),
        name: s.string("text"),
      });

      const result = await db.query(
        sql(NoEmailSchema)`
          SELECT 
            ${sql.output(UserTable).exclude(UserTable.email)} 
          FROM ${UserTable} 
          WHERE ${UserTable.id} = ${1}
        `,
      );

      expect(result.rows[0].name).toBe("Alice");
      expect(result.rows[0].id).toBeTypeOf("number");
    });

  it()
    .should("select a single column with sql.output(Table.col)")
    .test(async () => {
      const NameSchema = s.object({ name: s.string("text") });
      const result = await db.query(
        sql(
          NameSchema,
        )`SELECT ${sql.output(UserTable.name)} FROM ${UserTable} WHERE ${UserTable.id} = ${1}`,
      );
      expect(result.rows[0].name).toBe("Alice");
    });

  it()
    .should("return a json object for a row with sql.output(Table).json()")
    .test(async () => {
      const RowSchema = s.object({
        users: s.object({
          id: s.number("int4"),
          name: s.string("text"),
          email: s.string("text"),
        }),
      });
      const result = await db.query(
        sql(
          RowSchema,
        )`SELECT ${sql.output(UserTable).json()} FROM ${UserTable} WHERE ${UserTable.id} = ${1}`,
      );
      expect(result.rows[0].users.name).toBe("Alice");
    });

  it()
    .should("exclude a column from json output with .json().exclude(col)")
    .test(async () => {
      const RowSchema = s.object({
        users: s.object({
          id: s.number("int4"),
          name: s.string("text"),
        }),
      });
      const result = await db.query(
        sql(
          RowSchema,
        )`SELECT ${sql.output(UserTable).json().exclude(UserTable.email)} FROM ${UserTable} WHERE ${UserTable.id} = ${1}`,
      );
      expect(result.rows[0].users.name).toBe("Alice");
      expect(result.rows[0].users.id).toBeTypeOf("number");
    });

  it()
    .should("aggregate related rows as a json array with .json().array()")
    .test(async () => {
      const RowSchema = s.object({
        users: s.object({
          id: s.number("int4"),
          name: s.string("text"),
          email: s.string("text"),
        }),
        posts: s.array(s.unknown("jsonb")),
      });
      const result = await db.query(
        sql(RowSchema)`
          SELECT
            ${sql.output(UserTable).json()},
            ${sql.output(PostTable).json().array()}
          FROM ${UserTable}
          INNER JOIN ${PostTable} ON ${UserTable.id} = ${PostTable.user_id}
          WHERE ${UserTable.id} = ${1}
          GROUP BY ${UserTable.id}
        `,
      );
      expect(result.rows[0].users.name).toBe("Alice");
      expect(Array.isArray(result.rows[0].posts)).toBe(true);
      expect(result.rows[0].posts).toHaveLength(2);
    });
});
