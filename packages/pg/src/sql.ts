import type { StandardSchemaV1 } from "@standard-schema/spec";
import {
  createSqlTag,
  type FragmentSqlToken,
  type IdentifierSqlToken,
  type ListSqlToken,
  type QuerySqlToken,
  sql as slonikSql,
  type ValueExpression,
} from "slonik";
import type { Table } from "./table.js";
import {
  type AnyType,
  SLONIK_FRAGMENT,
  type SQLIdentifier,
  unsafeSQLFragment,
} from "./utils.js";

function filterBoolean<T>(arr: (T | null | undefined | false)[]): T[] {
  return arr.filter(Boolean) as T[];
}

function filterUndefined<T>(arr: (T | undefined)[]): T[] {
  return arr.filter((v): v is T => v !== undefined);
}

// Simple void schema validator
const voidParser = (value: unknown) => {
  if (value && typeof value === "object" && Object.keys(value).length === 0)
    return {};
  return {};
};

const sqlTag = createSqlTag({
  typeAliases: {
    void: voidParser as any,
  },
});

export type InferRowType<S extends Record<string, StandardSchemaV1>> = {
  [K in keyof S]: StandardSchemaV1.InferOutput<S[K]>;
};

const lastIdentifierName = (identifier: IdentifierSqlToken) => {
  return identifier.names[identifier.names.length - 1];
};

type SelectFragment = ReturnType<typeof sqlTag.fragment>;

interface SelectChainable extends SelectFragment {
  alias: (aliasName: string) => SelectChainable;
  array: () => SelectChainable;
  json: () => SelectChainable;
  exclude: (...columnsToExclude: SQLIdentifier[]) => SelectChainable;
}

type OptionalValueExpression = ValueExpression | undefined;

// VoidQueryFn now returns a QuerySqlToken<any>
type VoidQueryFn = (
  template: TemplateStringsArray,
  ...values: ValueExpression[]
) => QuerySqlToken<any>;

const sqlTagPlugins: {
  void: VoidQueryFn;
  comma: (
    ...args: [OptionalValueExpression[]] | OptionalValueExpression[]
  ) => ListSqlToken;
  alias: <T extends Table<AnyType>>(table: T, alias: string) => T;
  jsonArray: (values: Record<PropertyKey, AnyType>[]) => FragmentSqlToken;
  output: (
    tableOrColumn: Table<AnyType> | IdentifierSqlToken,
  ) => SelectChainable;
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
} = {
  void: sqlTag.typeAlias("void") as unknown as VoidQueryFn,

  comma: (...args: [OptionalValueExpression[]] | OptionalValueExpression[]) => {
    const values = (
      Array.isArray(args[0]) ? args[0] : args
    ) as OptionalValueExpression[];

    const filteredValues = filterUndefined(values);

    return sqlTag.join(filteredValues, sqlTag.fragment`, `);
  },

  alias: <T extends Table<AnyType>>(table: T, alias: string): T => {
    if (table.tableName === alias) {
      throw new Error(
        `Table alias cannot be the same as the table name: ${alias}`,
      );
    }

    const columnsAccessors = Object.fromEntries(
      table.cols.map((col) => [
        lastIdentifierName(col),
        sqlTag.identifier([alias, lastIdentifierName(col)]),
      ]),
    );

    return {
      ...table,
      ...columnsAccessors,
      tableName: alias,
      originalTableName: table.tableName,
      sql: `"${table.tableSchema}"."${table.tableName}" AS "${alias}"`,
      values: [],
      type: SLONIK_FRAGMENT,
    };
  },

  jsonArray(values: Record<PropertyKey, AnyType>[]) {
    return slonikSql.fragment`{${values.map((v) => JSON.stringify(JSON.stringify(v))).join(",")}}`;
  },

  output: <T extends Table<AnyType>>(
    tableOrColumn: T | SQLIdentifier,
  ): SelectChainable => {
    const createChainableSelect = (
      currentTable: Table<AnyType> | SQLIdentifier,
      currentAlias?: string,
      isArray = false,
      isJson = false,
    ): SelectChainable => {
      const getSqlFragment = (): SelectFragment => {
        if (!("tableName" in currentTable)) {
          const column = currentTable as SQLIdentifier;
          const columnName = column.names[column.names.length - 1];
          const aliasName = currentAlias || columnName;

          if (isJson) {
            if (isArray) {
              return sqlTag.fragment`array_agg(${column}) AS ${slonikSql.identifier([aliasName])}`;
            }
            return sqlTag.fragment`${column} AS ${slonikSql.identifier([aliasName])}`;
          }

          if (isArray) {
            return sqlTag.fragment`array_agg(${column}) AS ${slonikSql.identifier([aliasName])}`;
          }

          return sqlTag.fragment`${column} AS ${slonikSql.identifier([aliasName])}`;
        }

        const table = currentTable as Table<AnyType>;
        const aliasName = currentAlias || table.tableName;

        if (isJson) {
          if (isArray) {
            return sqlTag.fragment`array_agg(row_to_json(${slonikSql.identifier([table.tableName])}.*)) AS ${slonikSql.identifier([aliasName])}`;
          }
          return sqlTag.fragment`row_to_json(${slonikSql.identifier([table.tableName])}.*) AS ${slonikSql.identifier([aliasName])}`;
        }

        if (isArray) {
          return sqlTag.fragment`array_agg(${slonikSql.identifier([table.tableName])}.*) AS ${slonikSql.identifier([aliasName])}`;
        }

        if (currentAlias) {
          return sqlTag.fragment`${slonikSql.identifier([table.tableName])}.* AS ${slonikSql.identifier([aliasName])}`;
        }

        return sqlTag.fragment`${slonikSql.identifier([table.tableName])}.*`;
      };

      const createSelectResult = (
        sqlFragment: SelectFragment,
      ): SelectChainable => {
        const excludeMethod = (
          ...columnsToExclude: SQLIdentifier[]
        ): SelectChainable => {
          if (!("tableName" in currentTable)) {
            throw new Error("Cannot exclude columns from column selection");
          }

          const table = currentTable as Table<AnyType>;
          const excludedColumns = columnsToExclude.map((col) =>
            lastIdentifierName(col),
          );
          const availableColumns = table.cols.filter((col) => {
            const colName = lastIdentifierName(col);
            return !excludedColumns.includes(colName);
          });

          if (availableColumns.length === 0) {
            throw new Error("Cannot exclude all columns from table selection");
          }

          const aliasName = currentAlias || table.tableName;

          if (isJson) {
            const selectPairs = availableColumns
              .map((col) => {
                const colName = lastIdentifierName(col);
                return `'${colName}', "${table.tableName}"."${colName}"`;
              })
              .join(", ");

            if (isArray) {
              return createSelectResult(
                unsafeSQLFragment(
                  `array_agg(json_build_object(${selectPairs})) AS "${aliasName}"`,
                ),
              );
            }
            return createSelectResult(
              unsafeSQLFragment(
                `json_build_object(${selectPairs}) AS "${aliasName}"`,
              ),
            );
          }

          const columnList = availableColumns
            .map((col) => {
              const colName = lastIdentifierName(col);
              return `"${table.tableName}"."${colName}"`;
            })
            .join(", ");

          if (isArray) {
            const excludedFragment = unsafeSQLFragment(
              `array_agg((${columnList})) AS "${aliasName}"`,
            );
            return createSelectResult(excludedFragment);
          }

          const excludedFragment = unsafeSQLFragment(columnList);
          return createSelectResult(excludedFragment);
        };

        const aliasMethod = (aliasName: string): SelectChainable => {
          return createChainableSelect(
            currentTable,
            aliasName,
            isArray,
            isJson,
          );
        };

        const arrayMethod = (): SelectChainable => {
          return createChainableSelect(
            currentTable,
            currentAlias,
            true,
            isJson,
          );
        };

        const jsonMethod = (): SelectChainable => {
          return createChainableSelect(
            currentTable,
            currentAlias,
            isArray,
            true,
          );
        };

        return Object.assign(sqlFragment, {
          exclude: excludeMethod,
          alias: aliasMethod,
          array: arrayMethod,
          json: jsonMethod,
        });
      };

      const baseFragment = { ...getSqlFragment() };
      return createSelectResult(baseFragment);
    };

    if (typeof tableOrColumn === "object" && "tableName" in tableOrColumn) {
      return createChainableSelect(tableOrColumn as Table<AnyType>);
    }

    const column = tableOrColumn as SQLIdentifier;
    return createChainableSelect(column);
  },

  excluded: (cols: SQLIdentifier[], ignore: readonly SQLIdentifier[] = []) => {
    const colNames = cols.map((c) => lastIdentifierName(c));
    const excludedNames = ignore.map((c) => lastIdentifierName(c));
    const excludedCols = colNames.filter((c) => !excludedNames.includes(c));

    return unsafeSQLFragment(
      excludedCols.map((c) => `${c} = EXCLUDED."${c}"`).join(", "),
    );
  },

  inArray: (column: ValueExpression, values: OptionalValueExpression[]) => {
    const filteredValues = filterUndefined(values);

    if (filteredValues.length === 0) {
      return sqlTag.fragment`FALSE`;
    }

    return sqlTag.fragment`${column} IN (${sqlTag.join(
      filteredValues.map((v) => sqlTag.fragment`${v}`),
      sqlTag.fragment`, `,
    )})`;
  },

  target(column: IdentifierSqlToken) {
    return sqlTag.identifier([lastIdentifierName(column)]);
  },

  targets(...column: [IdentifierSqlToken[]] | IdentifierSqlToken[]) {
    const cols = (
      Array.isArray(column[0]) ? column[0] : column
    ) as IdentifierSqlToken[];

    return cols.map((c) => sqlTag.identifier([lastIdentifierName(c)]));
  },

  tuple: (
    ...tuple: [OptionalValueExpression[]] | OptionalValueExpression[]
  ) => {
    const values = (
      Array.isArray(tuple[0]) ? tuple[0] : tuple
    ) as OptionalValueExpression[];

    const filteredValues = filterUndefined(values);

    return sqlTag.fragment`(${sqlTag.join(filteredValues, sqlTag.fragment`, `)})`;
  },

  tuples(rows: OptionalValueExpression[][]) {
    const filteredRows = filterBoolean(
      rows.map((row) => {
        const filteredRow = filterUndefined(row);
        if (filteredRow.length === 0) return undefined;
        return filteredRow;
      }),
    );

    if (filteredRows.length === 0) {
      throw new Error("Cannot create tuples with no rows");
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

type CustomSQLTag = typeof sqlTagPlugins & {
  [K in keyof typeof sqlTag]: (typeof sqlTag)[K];
};

function createParser<S extends StandardSchemaV1>(schema: S) {
  return (value: unknown) => {
    const result = schema["~standard"].validate(value);
    if (result instanceof Promise) {
      throw new Error("Async validation not supported in sql tag");
    }
    if (result.issues) {
      throw new Error(JSON.stringify(result.issues));
    }
    return result.value;
  };
}

// Helper to cast internal tokens to QuerySqlToken
function castToken<T extends StandardSchemaV1>(token: any): QuerySqlToken<T> {
  return token as QuerySqlToken<T>;
}

// Type of the tagged template function
export type TaggedTemplateFn<T extends StandardSchemaV1> = (
  template: TemplateStringsArray,
  ...values: ValueExpression[]
) => QuerySqlToken<T>;

export type SQL = {
  (
    template: TemplateStringsArray,
    ...values: ValueExpression[]
  ): QuerySqlToken<any>;

  <S extends Record<string, StandardSchemaV1>>(
    table: Table<S>,
  ): TaggedTemplateFn<StandardSchemaV1<InferRowType<S>>>;

  <S extends StandardSchemaV1>(schema: S): TaggedTemplateFn<S>;
} & CustomSQLTag;

const createSQL = () => {
  // Default override for sql`...` returning generic token (any)
  function mainSql(
    template: TemplateStringsArray,
    ...values: ValueExpression[]
  ): QuerySqlToken<any>;

  function mainSql<S extends Record<string, StandardSchemaV1>>(
    table: Table<S>,
  ): TaggedTemplateFn<StandardSchemaV1<InferRowType<S>>>;

  function mainSql<S extends StandardSchemaV1>(schema: S): TaggedTemplateFn<S>;

  function mainSql(
    templateOrTableOrSchema:
      | TemplateStringsArray
      | Table<Record<string, StandardSchemaV1>>
      | StandardSchemaV1,
    ...values: ValueExpression[]
  ) {
    if (
      Array.isArray(templateOrTableOrSchema) &&
      "raw" in templateOrTableOrSchema
    ) {
      return castToken(
        sqlTag.fragment(
          templateOrTableOrSchema as TemplateStringsArray,
          ...values,
        ),
      );
    }

    if (
      typeof templateOrTableOrSchema === "object" &&
      templateOrTableOrSchema !== null &&
      "tableName" in templateOrTableOrSchema
    ) {
      const table = templateOrTableOrSchema as Table<
        Record<string, StandardSchemaV1>
      >;
      return (template: TemplateStringsArray, ...vals: ValueExpression[]) =>
        castToken(
          sqlTag.type(createParser(table.schema) as any)(template, ...vals),
        );
    }

    if (
      typeof templateOrTableOrSchema === "object" &&
      templateOrTableOrSchema !== null &&
      "~standard" in templateOrTableOrSchema
    ) {
      const schema = templateOrTableOrSchema as StandardSchemaV1;
      return (template: TemplateStringsArray, ...vals: ValueExpression[]) =>
        castToken(sqlTag.type(createParser(schema) as any)(template, ...vals));
    }

    throw new Error("Invalid arguments passed to sql()");
  }

  return Object.assign(mainSql, sqlTag, sqlTagPlugins) as SQL;
};

export const internalSQL: SQL = createSQL();

export { createSQL };
