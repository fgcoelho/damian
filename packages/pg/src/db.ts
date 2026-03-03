import { createPgDriverFactory } from "@slonik/pg-driver";
import {
  createPool,
  type DatabasePool,
  type DriverFactory,
  type DriverTypeParser,
  type Interceptor,
} from "slonik";

export type { DatabasePool, DriverTypeParser, Interceptor };

export type CreateDbOptions = {
  connectionString: string;
  driverFactory?: DriverFactory;
  interceptors?: readonly Interceptor[];
  typeParsers?: readonly DriverTypeParser[];
};

export function createDb(options: CreateDbOptions): Promise<DatabasePool> {
  const { connectionString, ...config } = options;

  return createPool(connectionString, {
    driverFactory: createPgDriverFactory(),
    ...config,
  });
}
