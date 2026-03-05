import {
  createSqlTag,
  type FragmentSqlToken,
  type IdentifierSqlToken,
  type ListSqlToken,
  type QuerySqlToken,
  sql as slonikSql,
  type ValueExpression,
} from "slonik";
import { DbError } from "../errors.js";
import type { TableShape } from "../table/index.js";
import {
  type AnyType,
  filterBoolean,
  filterUndefined,
  SLONIK_FRAGMENT,
  type SQLIdentifier,
  unsafeSQLFragment,
} from "../utils.js";
import { buildSelect, type SelectBuilder } from "./select.js";

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
  args: OptionalJoinArgs,
  glue: FragmentSqlToken,
): ListSqlToken {
  return sqlTag.join(filterUndefined(normalizeVarArgs(args)), glue);
}

type MapFn = {
  <T, R>(array: T[], fn: (item: T) => R): R[];
  <T, R>(array: T[], fn: (item: T, index: number) => R): R[];
};

type OptionalJoinArgs = [OptionalValueExpression[]] | OptionalValueExpression[];

export type SqlTagPlugins = {
  void: VoidQueryFn;
  map: MapFn;
  join: {
    (members: readonly ValueExpression[], glue: FragmentSqlToken): ListSqlToken;
    comma: (...args: OptionalJoinArgs) => ListSqlToken;
    and: (...args: OptionalJoinArgs) => ListSqlToken;
    or: (...args: OptionalJoinArgs) => ListSqlToken;
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
    (members: readonly ValueExpression[], glue: FragmentSqlToken) =>
      sqlTag.join(members, glue),
    {
      comma: (...args: OptionalJoinArgs) =>
        joinMembers(args, sqlTag.fragment`, `),
      and: (...args: OptionalJoinArgs) =>
        joinMembers(args, sqlTag.fragment` AND `),
      or: (...args: OptionalJoinArgs) =>
        joinMembers(args, sqlTag.fragment` OR `),
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
    const colsToUpdate = cols
      .map(getIdentifierTail)
      .filter((name) => !ignoredNames.has(name));
    return unsafeSQLFragment(
      colsToUpdate.map((name) => `${name} = EXCLUDED."${name}"`).join(", "),
    );
  },

  inArray(column: ValueExpression, values: OptionalValueExpression[]) {
    const filtered = filterUndefined(values);
    if (filtered.length === 0) {
      return sqlTag.fragment`FALSE`;
    }
    return sqlTag.fragment`${column} IN (${sqlTag.join(
      filtered.map((v) => sqlTag.fragment`${v}`),
      sqlTag.fragment`, `,
    )})`;
  },

  target(column: IdentifierSqlToken) {
    return sqlTag.identifier([getIdentifierTail(column)]);
  },

  targets(...column: [IdentifierSqlToken[]] | IdentifierSqlToken[]) {
    const cols = normalizeVarArgs(column);
    return cols.map((c) => sqlTag.identifier([getIdentifierTail(c)]));
  },

  tuple(...tuple: [OptionalValueExpression[]] | OptionalValueExpression[]) {
    const values = normalizeVarArgs(tuple);
    return sqlTag.fragment`(${sqlTag.join(filterUndefined(values), sqlTag.fragment`, `)})`;
  },

  tuples(rows: OptionalValueExpression[][]) {
    const filteredRows = filterBoolean(
      rows.map((row) => {
        const filtered = filterUndefined(row);
        return filtered.length === 0 ? undefined : filtered;
      }),
    );

    if (filteredRows.length === 0) {
      throw new DbError("EMPTY_TUPLES", "Cannot create tuples with no rows");
    }

    return sqlTag.fragment`${sqlTag.join(
      filteredRows.map(
        (row) => sqlTag.fragment`(${sqlTag.join(row, sqlTag.fragment`, `)})`,
      ),
      sqlTag.fragment`, `,
    )}`;
  },

  identity(context: "and" | "or") {
    return context === "and" ? sqlTag.fragment`TRUE` : sqlTag.fragment`FALSE`;
  },
};
