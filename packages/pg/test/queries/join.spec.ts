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

const PersonTable = table("public", "person", {
  id: s.number("int4"),
  name: s.string("text"),
  manager_id: s.nullable(s.number("int4")),
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
  await db.query(sql.void`
    CREATE TABLE person (
      id         serial PRIMARY KEY,
      name       text NOT NULL,
      manager_id int REFERENCES person(id)
    )
  `);
  await db.query(
    sql.void`INSERT INTO users (id, name, email) VALUES (1, 'Alice', 'alice@example.com')`,
  );
  await db.query(
    sql.void`INSERT INTO posts (user_id, title) VALUES (1, 'My Post')`,
  );
  await db.query(
    sql.void`INSERT INTO person (id, name, manager_id) VALUES (1, 'Boss', NULL), (2, 'Alice', 1)`,
  );
});

afterAll(async () => {
  await db.end();
});

describe("JOIN", () => {
  it()
    .should("join users and posts and return matched rows")
    .test(async () => {
      const result = await db.query(
        sql(
          s.object({
            user_name: s.string("text"),
            post_title: s.string("text"),
          }),
        )`
          SELECT
            ${sql.output(UserTable.name).alias("user_name")},
            ${sql.output(PostTable.title).alias("post_title")}
          FROM ${UserTable}
          INNER JOIN ${PostTable}
          ON ${UserTable.id} = ${PostTable.user_id}
        `,
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].user_name).toBe("Alice");
      expect(result.rows[0].post_title).toBe("My Post");
    });

  it()
    .should("join two aliased instances of the same table")
    .test(async () => {
      const employee = sql.alias(PersonTable, "employee");
      const manager = sql.alias(PersonTable, "manager");

      const result = await db.query(
        sql(
          s.object({
            employee_name: s.string("text"),
            manager_name: s.string("text"),
          }),
        )`
          SELECT
            ${sql.output(employee.name).alias("employee_name")},
            ${sql.output(manager.name).alias("manager_name")}
          FROM ${employee}
          INNER JOIN ${manager}
            ON ${employee.manager_id} = ${manager.id}
        `,
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].employee_name).toBe("Alice");
      expect(result.rows[0].manager_name).toBe("Boss");
    });

  it()
    .should(
      "select aliased table columns as json objects using sql.output(alias).json()",
    )
    .test(async () => {
      const employee = sql.alias(PersonTable, "employee");
      const manager = sql.alias(PersonTable, "manager");

      const RowSchema = s.object({
        employee: s.object({
          id: s.number("int4"),
          name: s.string("text"),
          manager_id: s.nullable(s.number("int4")),
        }),
        manager: s.object({
          id: s.number("int4"),
          name: s.string("text"),
          manager_id: s.nullable(s.number("int4")),
        }),
      });

      const result = await db.query(
        sql(RowSchema)`
          SELECT
            ${sql.output(employee).json()},
            ${sql.output(manager).json()}
          FROM ${employee}
          INNER JOIN ${manager} ON ${employee.manager_id} = ${manager.id}
        `,
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].employee.name).toBe("Alice");
      expect(result.rows[0].manager.name).toBe("Boss");
    });
});
