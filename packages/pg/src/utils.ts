import type { sql } from "slonik";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyType = any;

export const SLONIK_FRAGMENT = Symbol.for("SLONIK_TOKEN_FRAGMENT") as AnyType;

export const SLONIK_QUERY = Symbol.for("SLONIK_TOKEN_QUERY") as AnyType;

export const SLONIK_IDENTIFIER = Symbol.for(
  "SLONIK_TOKEN_IDENTIFIER",
) as AnyType;

export type SQLFragment = ReturnType<typeof sql.fragment>;

export type SQLIdentifier = ReturnType<typeof sql.identifier>;

export type SQLQuery = ReturnType<typeof sql.unsafe>;

export const unsafeSQLFragment = (sqlString: string): SQLFragment => ({
  sql: sqlString,
  values: [],
  type: SLONIK_FRAGMENT,
});
