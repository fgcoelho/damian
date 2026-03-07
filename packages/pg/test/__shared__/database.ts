import { PGlite } from "@electric-sql/pglite";
import { createPGLiteDriverFactory } from "slonik-pglite-driver";
import type { CreateDbOptions, DatabasePool } from "../../src/driver/db";
import { createDb } from "../../src/driver/db";

type PGliteParam = Parameters<typeof createPGLiteDriverFactory>[0];

async function noopResetConnection(): Promise<void> {}

export async function createTestPool(
  options: Partial<CreateDbOptions> = {},
): Promise<DatabasePool> {
  const pg = new PGlite();

  const driverFactory = createPGLiteDriverFactory(pg as unknown as PGliteParam);

  return createDb({
    connectionString: "postgres://",
    driverFactory,
    resetConnection: noopResetConnection,
    ...options,
  });
}

export function createSharedPool() {
  let pg: PGlite;
  let db: DatabasePool;

  return {
    pool: () => db,
    setup: async () => {
      pg = new PGlite();
      const driverFactory = createPGLiteDriverFactory(
        pg as unknown as PGliteParam,
      );
      db = await createDb({
        connectionString: "postgres://",
        driverFactory,
      });
    },
    teardown: async () => {
      await db.end();
    },
  };
}
