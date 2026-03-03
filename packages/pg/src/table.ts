import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { TypeNameIdentifier, ValueExpression } from "slonik";
import { internalSQL as sql } from "./sql.js";
import {
  type AnyType,
  SLONIK_FRAGMENT,
  type SQLFragment,
  type SQLIdentifier,
} from "./utils.js";

type CreateRowsReturn = {
  cols: SQLIdentifier[];
  rows: ValueExpression[][];
  types: TypeNameIdentifier[];
};

type CreateRowReturn = {
  cols: SQLIdentifier[];
  row: ValueExpression[];
  types: TypeNameIdentifier[];
};

export type Column<S extends StandardSchemaV1> = SQLIdentifier &
  StandardSchemaV1<
    StandardSchemaV1.InferInput<S>,
    StandardSchemaV1.InferOutput<S>
  >;

type InferRowType<S extends Record<string, StandardSchemaV1>> = {
  [K in keyof S]: StandardSchemaV1.InferOutput<S[K]>;
};

export type Table<S extends Record<string, StandardSchemaV1>> = {
  [K in keyof S]: Column<S[K]>;
} & {
  tableName: string;
  tableSchema: string;
  schema: StandardSchemaV1<InferRowType<S>>;
  cols: Column<S[keyof S]>[];
  types: TypeNameIdentifier[];

  createRows(values: StandardSchemaV1.InferInput<Table<S>>[]): CreateRowsReturn;
  createPartialRows(
    values: Partial<StandardSchemaV1.InferInput<Table<S>>>[],
  ): CreateRowsReturn;

  createRow(values: StandardSchemaV1.InferInput<Table<S>>): CreateRowReturn;
  createPartialRow(
    values: Partial<StandardSchemaV1.InferInput<Table<S>>>,
  ): CreateRowReturn;

  sql: string;
  values: ValueExpression[];
  type: typeof SLONIK_FRAGMENT;
  // Table itself is a standard schema for the row
  "~standard": StandardSchemaV1<InferRowType<S>>["~standard"];
} & SQLFragment;

export function table<S extends Record<string, StandardSchemaV1>>(
  tableSchema: string,
  tableName: string,
  shape: S,
): Table<S> {
  const cols = Object.keys(shape);
  const schema = createObjectSchema(shape);

  // We assume the schema objects might have a description property or similar for SQL type mapping
  // If not, we fall back to generic or empty.
  const typeMap = createTypeMap(shape, cols);
  const types = cols.map((col) => typeMap[col]);

  const columnsAccessors = createTableQualifiedColumnAccessors(
    shape,
    cols,
    tableName,
  );

  const unqualifiedCols = cols.map((col) => {
    const colIdentifier = sql.identifier([col]);
    const schema = shape[col];
    return {
      ...colIdentifier,
      "~standard": schema["~standard"],
    } as Column<any>;
  });

  const tableObj = {
    ...columnsAccessors,
    tableName,
    tableSchema,
    schema,
    cols: unqualifiedCols,
    types: [...types],

    createRows: (values: any[]) => createRowsImpl(values, cols, shape),
    createPartialRows: (values: any[]) => createRowsImpl(values, cols, shape),

    createRow: (values: any) => createRowImpl(values, cols, shape),
    createPartialRow: (values: any) => createRowImpl(values, cols, shape),

    sql: `"${tableSchema}"."${tableName}"`,
    values: [],
    type: SLONIK_FRAGMENT as AnyType,
    "~standard": schema["~standard"],
  };

  return tableObj as unknown as Table<S>;
}

function createObjectSchema<S extends Record<string, StandardSchemaV1>>(
  shape: S,
): StandardSchemaV1<InferRowType<S>> {
  return {
    "~standard": {
      version: 1,
      vendor: "damiandb",
      validate: (value) => {
        if (typeof value !== "object" || value === null) {
          return {
            issues: [
              {
                message: "Expected object",
              },
            ],
          };
        }

        // Simplified validation: return value as compatible type
        return { value: value as InferRowType<S> };
      },
    },
  };
}

function createTypeMap<S extends Record<string, StandardSchemaV1>>(
  shape: S,
  cols: string[],
): Record<string, string> {
  return Object.fromEntries(
    cols.map((col) => {
      const s = shape[col] as any;
      // Try to get SQL type from sqlType property, fallback to "text"
      return [col, s.sqlType || "text"];
    }),
  );
}

function createTableQualifiedColumnAccessors<
  S extends Record<string, StandardSchemaV1>,
>(shape: S, cols: string[], tableName: string): Record<string, Column<any>> {
  return Object.fromEntries(
    cols.map((key) => {
      const colIdentifier = sql.identifier([tableName, key]);
      const schema = shape[key];

      const col: Column<any> = {
        ...colIdentifier,
        "~standard": schema["~standard"],
      };

      return [key, col];
    }),
  );
}

function getIncludedColumns(values: any[], cols: string[]): string[] {
  const includedSet = new Set<string>();

  for (const record of values) {
    for (const col of cols) {
      const cell = (record as AnyType)[col];
      if (cell !== undefined) {
        includedSet.add(col);
      }
    }
  }

  return Array.from(includedSet);
}

function convertCellValue(cell: unknown): ValueExpression {
  if (cell === undefined || cell === null) {
    return null;
  }

  if (
    typeof cell === "object" &&
    !Array.isArray(cell) &&
    typeof (cell as { toISO?: unknown }).toISO === "function"
  ) {
    return (cell as { toISO: () => string }).toISO();
  }

  if (Array.isArray(cell)) {
    if (!cell.length) {
      return "{}";
    }

    if (cell[0].toString() === "[object Object]") {
      return JSON.stringify(cell);
    }

    return `{${cell.join(",")}}`;
  }

  if (typeof cell === "object") {
    return JSON.stringify(cell);
  }

  return cell as ValueExpression;
}

function recordToRow(
  record: any,
  includedColumns: string[],
): ValueExpression[] {
  return includedColumns.map((col) => {
    const cell = (record as AnyType)[col];
    return convertCellValue(cell);
  });
}

function createRowsImpl<S extends Record<string, StandardSchemaV1>>(
  values: any[],
  cols: string[],
  shape: S,
): CreateRowsReturn {
  const includedColumns = getIncludedColumns(values, cols);
  const typeMap = createTypeMap(shape, cols);
  const types = includedColumns.map((col) => typeMap[col]);

  const rows = values.map((record) => recordToRow(record, includedColumns));

  return {
    cols: includedColumns.map((col) => sql.identifier([col])),
    rows,
    types,
  };
}

function createRowImpl<S extends Record<string, StandardSchemaV1>>(
  values: any,
  cols: string[],
  shape: S,
): CreateRowReturn {
  const includedColumns = getIncludedColumns([values], cols);
  const typeMap = createTypeMap(shape, cols);
  const types = includedColumns.map((col) => typeMap[col]);

  const row = recordToRow(values, includedColumns);

  return {
    cols: includedColumns.map((col) => sql.identifier([col])),
    row,
    types,
  };
}
