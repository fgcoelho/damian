import type { PGlite } from "@electric-sql/pglite";
import {
  type DatabaseColumn,
  type DatabaseSchema,
  type DatabaseTable,
  type ForeignKeyConstraint,
  getTableId,
  type PrimaryKeyConstraint,
  type UniqueConstraint,
} from "./schema-model";

type ColumnRow = {
  schema_name: string;
  table_name: string;
  column_name: string;
  ordinal_position: number;
  full_data_type: string;
  data_type: string;
  udt_name: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  datetime_precision: number | null;
};

type ConstraintRow = {
  schema_name: string;
  table_name: string;
  constraint_name: string;
  constraint_type: "p" | "u" | "f";
  column_position: number;
  column_name: string;
  foreign_schema: string | null;
  foreign_table: string | null;
  foreign_column: string | null;
  on_update: string | null;
  on_delete: string | null;
};

type TableBucket = {
  table: DatabaseTable;
  primaryKeyByName: Map<string, string[]>;
  uniqueByName: Map<string, string[]>;
  foreignKeyByName: Map<string, ForeignKeyConstraint>;
};

const COLUMN_QUERY = `
  SELECT
    cols.table_schema AS schema_name,
    cols.table_name,
    cols.column_name,
    cols.ordinal_position,
    format_type(att.atttypid, att.atttypmod) AS full_data_type,
    cols.data_type,
    cols.udt_name,
    cols.is_nullable,
    cols.column_default,
    cols.character_maximum_length,
    cols.numeric_precision,
    cols.numeric_scale,
    cols.datetime_precision
  FROM information_schema.columns AS cols
  JOIN pg_namespace AS ns
    ON ns.nspname = cols.table_schema
  JOIN pg_class AS cls
    ON cls.relname = cols.table_name
   AND cls.relnamespace = ns.oid
  JOIN pg_attribute AS att
    ON att.attrelid = cls.oid
   AND att.attname = cols.column_name
  WHERE cols.table_schema NOT IN ('pg_catalog', 'information_schema')
    AND cls.relkind = 'r'
    AND att.attnum > 0
    AND NOT att.attisdropped
  ORDER BY cols.table_schema, cols.table_name, cols.ordinal_position
`;

const CONSTRAINT_QUERY = `
  SELECT
    ns.nspname AS schema_name,
    cls.relname AS table_name,
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    cols.ordinality AS column_position,
    att.attname AS column_name,
    refns.nspname AS foreign_schema,
    refcls.relname AS foreign_table,
    refatt.attname AS foreign_column,
    CASE con.confupdtype
      WHEN 'a' THEN 'no action'
      WHEN 'r' THEN 'restrict'
      WHEN 'c' THEN 'cascade'
      WHEN 'n' THEN 'set null'
      WHEN 'd' THEN 'set default'
      ELSE NULL
    END AS on_update,
    CASE con.confdeltype
      WHEN 'a' THEN 'no action'
      WHEN 'r' THEN 'restrict'
      WHEN 'c' THEN 'cascade'
      WHEN 'n' THEN 'set null'
      WHEN 'd' THEN 'set default'
      ELSE NULL
    END AS on_delete
  FROM pg_constraint AS con
  JOIN pg_class AS cls
    ON cls.oid = con.conrelid
  JOIN pg_namespace AS ns
    ON ns.oid = cls.relnamespace
  JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ordinality)
    ON TRUE
  JOIN pg_attribute AS att
    ON att.attrelid = con.conrelid
   AND att.attnum = cols.attnum
  LEFT JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS refcols(attnum, ordinality)
    ON refcols.ordinality = cols.ordinality
  LEFT JOIN pg_class AS refcls
    ON refcls.oid = con.confrelid
  LEFT JOIN pg_namespace AS refns
    ON refns.oid = refcls.relnamespace
  LEFT JOIN pg_attribute AS refatt
    ON refatt.attrelid = con.confrelid
   AND refatt.attnum = refcols.attnum
  WHERE con.contype IN ('p', 'u', 'f')
    AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
    AND cls.relkind = 'r'
  ORDER BY ns.nspname, cls.relname, con.conname, cols.ordinality
`;

function createTableBucket(row: ColumnRow): TableBucket {
  return {
    table: {
      schema: row.schema_name,
      table: row.table_name,
      columns: [],
      primaryKey: null,
      uniqueConstraints: [],
      foreignKeys: [],
    },
    primaryKeyByName: new Map(),
    uniqueByName: new Map(),
    foreignKeyByName: new Map(),
  };
}

function mapColumn(row: ColumnRow): DatabaseColumn {
  return {
    name: row.column_name,
    ordinalPosition: row.ordinal_position,
    fullDataType: row.full_data_type,
    dataType: row.data_type,
    udtName: row.udt_name,
    nullable: row.is_nullable === "YES",
    defaultValue: row.column_default,
    characterMaximumLength: row.character_maximum_length,
    numericPrecision: row.numeric_precision,
    numericScale: row.numeric_scale,
    datetimePrecision: row.datetime_precision,
  };
}

function appendConstraintColumn(
  map: Map<string, string[]>,
  constraintName: string,
  columnName: string,
): void {
  const columns = map.get(constraintName);
  if (columns) {
    columns.push(columnName);
    return;
  }

  map.set(constraintName, [columnName]);
}

function addConstraintToBucket(bucket: TableBucket, row: ConstraintRow): void {
  if (row.constraint_type === "p") {
    appendConstraintColumn(
      bucket.primaryKeyByName,
      row.constraint_name,
      row.column_name,
    );
    return;
  }

  if (row.constraint_type === "u") {
    appendConstraintColumn(
      bucket.uniqueByName,
      row.constraint_name,
      row.column_name,
    );
    return;
  }

  const existing = bucket.foreignKeyByName.get(row.constraint_name);
  if (existing) {
    existing.columns.push(row.column_name);
    if (row.foreign_column) {
      existing.foreignColumns.push(row.foreign_column);
    }
    return;
  }

  bucket.foreignKeyByName.set(row.constraint_name, {
    name: row.constraint_name,
    columns: [row.column_name],
    foreignSchema: row.foreign_schema ?? "public",
    foreignTable: row.foreign_table ?? "",
    foreignColumns: row.foreign_column ? [row.foreign_column] : [],
    onUpdate: row.on_update,
    onDelete: row.on_delete,
  });
}

function finalizeBucket(bucket: TableBucket): DatabaseTable {
  const [primaryKeyName] = bucket.primaryKeyByName.keys();
  if (primaryKeyName) {
    bucket.table.primaryKey = {
      name: primaryKeyName,
      columns: bucket.primaryKeyByName.get(primaryKeyName) ?? [],
    } satisfies PrimaryKeyConstraint;
  }

  bucket.table.uniqueConstraints = [...bucket.uniqueByName.entries()].map(
    ([name, columns]) => ({ name, columns }) satisfies UniqueConstraint,
  );
  bucket.table.foreignKeys = [...bucket.foreignKeyByName.values()];
  bucket.table.columns.sort((a, b) => a.ordinalPosition - b.ordinalPosition);

  return bucket.table;
}

export async function introspectDatabaseSchema(
  pg: PGlite,
): Promise<DatabaseSchema> {
  const [columnRows, constraintRows] = await Promise.all([
    pg.query<ColumnRow>(COLUMN_QUERY),
    pg.query<ConstraintRow>(CONSTRAINT_QUERY),
  ]);

  const tables = new Map<string, TableBucket>();

  for (const row of columnRows.rows) {
    const key = getTableId(row.schema_name, row.table_name);
    const bucket = tables.get(key) ?? createTableBucket(row);
    bucket.table.columns.push(mapColumn(row));
    tables.set(key, bucket);
  }

  for (const row of constraintRows.rows) {
    const key = getTableId(row.schema_name, row.table_name);
    const bucket = tables.get(key);
    if (!bucket) continue;
    addConstraintToBucket(bucket, row);
  }

  return {
    tables: [...tables.values()].map(finalizeBucket).sort((left, right) => {
      if (left.schema === right.schema) {
        return left.table.localeCompare(right.table);
      }
      return left.schema.localeCompare(right.schema);
    }),
  };
}
