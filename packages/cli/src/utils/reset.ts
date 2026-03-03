import { createDb, createSQL, s } from "@damiandb/pg";

const sql = createSQL();

const schemaRow = s.object({ schema_name: s.string("text") });

export async function resetDatabase(connectionString: string): Promise<void> {
  const db = await createDb({ connectionString });

  const result = await db.query(
    sql(schemaRow)`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
        AND schema_name NOT LIKE 'pg_%'
    `,
  );

  const schemas = result.rows.map((r) => r.schema_name);

  if (schemas.length > 0) {
    await db.transaction(async (tx) => {
      for (const schema of schemas) {
        await tx.query(
          sql.void`DROP SCHEMA ${sql.identifier([schema])} CASCADE`,
        );
      }
    });
  }

  await db.query(sql.void`CREATE SCHEMA public`);

  await db.end();
}
