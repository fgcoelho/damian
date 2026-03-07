import type { sql } from "slonik";

export type Promisable<T> = T | Promise<T>;

export type AnyType = any;

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export const SLONIK_FRAGMENT = Symbol.for("SLONIK_TOKEN_FRAGMENT") as AnyType;

export const SLONIK_IDENTIFIER = Symbol.for(
  "SLONIK_TOKEN_IDENTIFIER",
) as AnyType;

export type SQLFragment = ReturnType<typeof sql.fragment>;

export type SQLIdentifier = ReturnType<typeof sql.identifier>;

export type SQLQuery = ReturnType<typeof sql.unsafe>;

export function filterUndefined<T>(arr: (T | undefined)[]): T[] {
  return arr.filter((v): v is T => v !== undefined);
}
