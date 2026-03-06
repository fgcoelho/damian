import {
  createSqlTag,
  type IdentifierSqlToken,
  sql as slonikSql,
} from "slonik";
import { DbError } from "../errors.js";
import type { TableShape } from "../table/index.js";
import type { AnyType, SQLIdentifier } from "../utils.js";

const sqlTag = createSqlTag({ typeAliases: { void: (() => {}) as AnyType } });

type SelectFragment = ReturnType<typeof sqlTag.fragment>;

export interface SelectBuilder extends SelectFragment {
  as: (aliasName: string) => SelectBuilder;
  alias: (aliasName: string) => SelectBuilder;
  array: () => SelectBuilder;
  json: () => SelectBuilder;
  exclude: (...cols: SQLIdentifier[]) => SelectBuilder;
}

function getIdentifierTail(identifier: IdentifierSqlToken): string {
  return identifier.names[identifier.names.length - 1];
}

function buildColumnFragment(
  column: SQLIdentifier,
  aliasName: string,
  isArray: boolean,
): SelectFragment {
  if (isArray) {
    return sqlTag.fragment`array_agg(${column}) AS ${slonikSql.identifier([aliasName])}`;
  }
  return sqlTag.fragment`${column} AS ${slonikSql.identifier([aliasName])}`;
}

function buildTableFragment(
  table: TableShape,
  aliasName: string,
  isArray: boolean,
  isJson: boolean,
): SelectFragment {
  const tableId = slonikSql.identifier([table.tableName]);
  const aliasId = slonikSql.identifier([aliasName]);

  if (isJson && isArray) {
    return sqlTag.fragment`array_agg(row_to_json(${tableId}.*)) AS ${aliasId}`;
  }
  if (isJson) {
    return sqlTag.fragment`row_to_json(${tableId}.*) AS ${aliasId}`;
  }
  if (isArray) {
    return sqlTag.fragment`array_agg(${tableId}.*) AS ${aliasId}`;
  }
  if (aliasName !== table.tableName) {
    return sqlTag.fragment`${tableId}.* AS ${aliasId}`;
  }
  return sqlTag.fragment`${tableId}.*`;
}

function buildExcludedColumnsFragment(
  table: TableShape,
  aliasName: string,
  columnsToExclude: SQLIdentifier[],
  isArray: boolean,
  isJson: boolean,
): SelectFragment {
  const excludedNames = new Set(columnsToExclude.map(getIdentifierTail));
  const available = table.cols.filter(
    (col: IdentifierSqlToken) => !excludedNames.has(getIdentifierTail(col)),
  );

  if (available.length === 0) {
    throw new DbError(
      "EMPTY_EXCLUDED_COLUMNS",
      "Cannot exclude all columns from table selection",
    );
  }

  if (isJson) {
    const pairsFrags = available.map((col) => {
      const colName = getIdentifierTail(col);
      return sqlTag.fragment`${colName}, ${slonikSql.identifier([table.tableName, colName])}`;
    });
    const joinedPairs = sqlTag.join(pairsFrags, sqlTag.fragment`, `);

    if (isArray) {
      return sqlTag.fragment`array_agg(json_build_object(${joinedPairs})) AS ${slonikSql.identifier([aliasName])}`;
    }
    return sqlTag.fragment`json_build_object(${joinedPairs}) AS ${slonikSql.identifier([aliasName])}`;
  }

  const columnFrags = available.map((col) =>
    slonikSql.identifier([table.tableName, getIdentifierTail(col)]),
  );
  const joinedColumns = sqlTag.join(columnFrags, sqlTag.fragment`, `);

  if (isArray) {
    return sqlTag.fragment`array_agg((${joinedColumns})) AS ${slonikSql.identifier([aliasName])}`;
  }
  return sqlTag.fragment`${joinedColumns}`;
}

function resolveFragment(
  target: TableShape | SQLIdentifier,
  aliasName: string | undefined,
  isArray: boolean,
  isJson: boolean,
  columnsToExclude?: SQLIdentifier[],
): SelectFragment {
  const isTableTarget = "tableName" in target;

  if (!isTableTarget) {
    const column = target as SQLIdentifier;
    const resolvedAlias = aliasName ?? getIdentifierTail(column);
    return buildColumnFragment(column, resolvedAlias, isArray);
  }

  const table = target as TableShape;
  const resolvedAlias = aliasName ?? table.tableName;

  if (columnsToExclude && columnsToExclude.length > 0) {
    return buildExcludedColumnsFragment(
      table,
      resolvedAlias,
      columnsToExclude,
      isArray,
      isJson,
    );
  }

  return buildTableFragment(table, resolvedAlias, isArray, isJson);
}

export function buildSelect(
  target: TableShape | SQLIdentifier,
  aliasName?: string,
  isArray = false,
  isJson = false,
  columnsToExclude?: SQLIdentifier[],
): SelectBuilder {
  const fragment = resolveFragment(
    target,
    aliasName,
    isArray,
    isJson,
    columnsToExclude,
  );

  const builder: SelectBuilder = Object.assign(
    { ...fragment },
    {
      as: (name: string) =>
        buildSelect(target, name, isArray, isJson, columnsToExclude),
      alias: (name: string) =>
        buildSelect(target, name, isArray, isJson, columnsToExclude),
      array: () =>
        buildSelect(target, aliasName, true, isJson, columnsToExclude),
      json: () =>
        buildSelect(target, aliasName, isArray, true, columnsToExclude),
      exclude: (...cols: SQLIdentifier[]) => {
        if (!("tableName" in target)) {
          throw new DbError(
            "INVALID_SELECTION",
            "Cannot exclude columns from column selection",
          );
        }
        return buildSelect(target, aliasName, isArray, isJson, cols);
      },
    },
  );

  return builder;
}

export type { SelectBuilder as SelectChainable };
