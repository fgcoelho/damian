export { createPgDriverFactory } from "@slonik/pg-driver";
export {
  createBigintTypeParser,
  createDateTypeParser,
  createIntervalTypeParser,
  createNumericTypeParser,
  createTimestampTypeParser,
  createTypeParserPreset,
} from "slonik";

export type {
  CreateDbOptions,
  DatabasePool,
  DriverTypeParser,
  Interceptor,
} from "./db.js";
export { createDb } from "./db.js";
export type { DbErrorCode } from "./errors.js";
export { DbError } from "./errors.js";

export type { DbSchema } from "./schema/index.js";
export * as s from "./schema/index.js";
export type { SelectBuilder, SQL, TaggedTemplateFn } from "./sql/index.js";
export { buildSelect, createSQL, sql } from "./sql/index.js";

export type { Column, RowResult, RowsResult, Table } from "./table/index.js";
export { table } from "./table/index.js";

export type {
  Prettify,
  SQLFragment,
  SQLIdentifier,
  SQLQuery,
} from "./utils.js";

export function defineTypings<
  TShape extends Record<string, Record<string, Record<string, unknown>>>,
>() {
  return <
    const T extends Partial<{
      [TSchema in keyof TShape]?: {
        [TTable in keyof TShape[TSchema]]?: {
          [TColumn in keyof TShape[TSchema][TTable]]?: unknown;
        };
      };
    }>,
  >(
    customTypings: T,
  ): T => customTypings;
}

export const typingsFactory = defineTypings;
