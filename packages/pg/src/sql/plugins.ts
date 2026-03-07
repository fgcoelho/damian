import {
  createSqlTag,
  type FragmentSqlToken,
  type IdentifierSqlToken,
  type ListSqlToken,
  type QuerySqlToken,
  type SqlToken,
  sql as slonikSql,
  type ValueExpression,
} from "slonik";
import { DbError } from "../lib/errors";
import {
  type AnyType,
  filterUndefined,
  SLONIK_FRAGMENT,
  type SQLIdentifier,
} from "../lib/utils";
import type { TableShape } from "../table/types";
import { buildSelect, type SelectBuilder } from "./select";

const sqlTag = createSqlTag({ typeAliases: { void: (() => {}) as AnyType } });

type OptionalValueExpression = ValueExpression | undefined;

type VoidQueryFn = (
  template: TemplateStringsArray,
  ...values: ValueExpression[]
) => QuerySqlToken<AnyType>;

function getIdentifierTail(identifier: IdentifierSqlToken): string {
  return identifier.names[identifier.names.length - 1];
}

function normalizeVarArgs<T>(args: [T[]] | T[]): T[] {
  return Array.isArray(args[0]) ? (args[0] as T[]) : (args as T[]);
}

function joinMembers(
  args: JoinValueArgs,
  glue: FragmentSqlToken,
): ListSqlToken {
  return sqlTag.join(filterUndefined(normalizeVarArgs(args)), glue);
}

function buildTuple(values: ValueExpression[]): FragmentSqlToken {
  return sqlTag.fragment`(${sqlTag.join(values, sqlTag.fragment`, `)})`;
}

type MapFn = {
  <T, R>(array: T[], fn: (item: T) => R): R[];
  <T, R>(array: T[], fn: (item: T, index: number) => R): R[];
};

type JoinValueArgs = [OptionalValueExpression[]] | OptionalValueExpression[];

export type SqlTagPlugins = {
  void: VoidQueryFn;
  map: MapFn;
  join: {
    (members: readonly SqlToken[], glue: FragmentSqlToken): ListSqlToken;
    comma: (...args: JoinValueArgs) => ListSqlToken;
    and: (...args: JoinValueArgs) => ListSqlToken;
    or: (...args: JoinValueArgs) => ListSqlToken;
  };
  alias: <T extends TableShape>(table: T, aliasName: string) => T;
  jsonArray: (values: Record<PropertyKey, AnyType>[]) => FragmentSqlToken;
  output: (tableOrColumn: TableShape | IdentifierSqlToken) => SelectBuilder;
  excluded: (
    cols: IdentifierSqlToken[],
    ignore?: readonly IdentifierSqlToken[],
  ) => FragmentSqlToken;
  inArray: (
    column: ValueExpression,
    values: OptionalValueExpression[],
  ) => FragmentSqlToken;
  target: (column: IdentifierSqlToken) => IdentifierSqlToken;
  targets: (
    ...column: [IdentifierSqlToken[]] | IdentifierSqlToken[]
  ) => IdentifierSqlToken[];
  tuple: (
    ...tuple: [OptionalValueExpression[]] | OptionalValueExpression[]
  ) => FragmentSqlToken;
  tuples: (rows: OptionalValueExpression[][]) => FragmentSqlToken;
  identity: (context: "and" | "or") => FragmentSqlToken;
};

export const sqlTagPlugins: SqlTagPlugins = {
  void: sqlTag.typeAlias("void") as unknown as VoidQueryFn,

  map<T, R>(array: T[], fn: (item: T, index: number) => R): R[] {
    return array.map(fn);
  },

  join: Object.assign(
    (members: readonly SqlToken[], glue: FragmentSqlToken) =>
      sqlTag.join(members, glue),
    {
      comma: (...args: JoinValueArgs) => joinMembers(args, sqlTag.fragment`, `),
      and: (...args: JoinValueArgs) =>
        joinMembers(args, sqlTag.fragment` AND `),
      or: (...args: JoinValueArgs) => joinMembers(args, sqlTag.fragment` OR `),
    },
  ),

  alias<T extends TableShape>(table: T, aliasName: string): T {
    if (table.tableName === aliasName) {
      throw new DbError(
        "TABLE_ALIAS_SAME_AS_NAME",
        `Table alias cannot be the same as the table name: ${aliasName}`,
      );
    }

    const columnAccessors = Object.fromEntries(
      table.cols.map((col: IdentifierSqlToken) => [
        getIdentifierTail(col),
        sqlTag.identifier([aliasName, getIdentifierTail(col)]),
      ]),
    );

    return {
      ...table,
      ...columnAccessors,
      tableName: aliasName,
      originalTableName: table.tableName,
      sql: `"${table.tableSchema}"."${table.tableName}" AS "${aliasName}"`,
      values: [],
      type: SLONIK_FRAGMENT,
    };
  },

  jsonArray(values: Record<PropertyKey, AnyType>[]) {
    return slonikSql.fragment`{${values.map((v) => JSON.stringify(JSON.stringify(v))).join(",")}}`;
  },

  output(tableOrColumn: TableShape | IdentifierSqlToken): SelectBuilder {
    return buildSelect(tableOrColumn);
  },

  excluded(cols: SQLIdentifier[], ignore: readonly SQLIdentifier[] = []) {
    const ignoredNames = new Set(ignore.map(getIdentifierTail));
    const assignments = cols
      .map(getIdentifierTail)
      .filter((name) => !ignoredNames.has(name))
      .map(
        (name) =>
          sqlTag.fragment`${sqlTag.identifier([name])} = EXCLUDED.${sqlTag.identifier([name])}`,
      );
    return sqlTag.fragment`${joinMembers(assignments, sqlTag.fragment`, `)}`;
  },

  inArray(column: ValueExpression, values: OptionalValueExpression[]) {
    const filtered = filterUndefined(values);

    if (filtered.length === 0) {
      return sqlTag.fragment`FALSE`;
    }

    return sqlTag.fragment`${column} IN ${buildTuple(filtered)}`;
  },

  target(column: IdentifierSqlToken) {
    return sqlTag.identifier([getIdentifierTail(column)]);
  },

  targets(...column: [IdentifierSqlToken[]] | IdentifierSqlToken[]) {
    const cols = normalizeVarArgs(column);
    return cols.map((c) => sqlTag.identifier([getIdentifierTail(c)]));
  },

  tuple(...tuple: [OptionalValueExpression[]] | OptionalValueExpression[]) {
    return sqlTag.fragment`(${joinMembers(tuple, sqlTag.fragment`, `)})`;
  },

  tuples(rows: OptionalValueExpression[][]) {
    const validRows = rows
      .map((row) => filterUndefined(row))
      .filter((row) => row.length > 0);

    if (validRows.length === 0) {
      throw new DbError("EMPTY_TUPLES", "Cannot create tuples with no rows");
    }

    return sqlTag.fragment`${sqlTag.join(validRows.map(buildTuple), sqlTag.fragment`, `)}`;
  },

  identity(context: "and" | "or") {
    return context === "and" ? sqlTag.fragment`TRUE` : sqlTag.fragment`FALSE`;
  },
};
