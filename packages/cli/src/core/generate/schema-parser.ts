type ColumnTypeEntry = {
  prefixes: string[];
  schema: string;
  db: string;
};

const TYPE_MAP: ColumnTypeEntry[] = [
  { prefixes: ["uuid"], schema: 's.string("uuid")', db: "uuid" },
  {
    prefixes: ["character varying", "varchar"],
    schema: 's.string("varchar")',
    db: "varchar",
  },
  { prefixes: ["character", "char"], schema: 's.string("char")', db: "char" },
  { prefixes: ["text"], schema: 's.string("text")', db: "text" },
  {
    prefixes: ["bit varying", "varbit"],
    schema: 's.string("varbit")',
    db: "varbit",
  },
  { prefixes: ["bit"], schema: 's.string("bit")', db: "bit" },
  { prefixes: ["jsonb"], schema: 's.any("jsonb")', db: "jsonb" },
  { prefixes: ["json"], schema: 's.any("json")', db: "json" },
  { prefixes: ["xml"], schema: 's.string("xml")', db: "xml" },
  { prefixes: ["bigint", "int8"], schema: 's.number("bigint")', db: "bigint" },
  {
    prefixes: ["bigserial", "serial8"],
    schema: 's.number("bigserial")',
    db: "bigserial",
  },
  {
    prefixes: ["integer", "int4", "int"],
    schema: 's.number("integer")',
    db: "integer",
  },
  {
    prefixes: ["smallint", "int2"],
    schema: 's.number("smallint")',
    db: "smallint",
  },
  {
    prefixes: ["smallserial", "serial2"],
    schema: 's.number("smallserial")',
    db: "smallserial",
  },
  {
    prefixes: ["serial4", "serial"],
    schema: 's.number("serial")',
    db: "serial",
  },
  { prefixes: ["real", "float4"], schema: 's.number("real")', db: "real" },
  {
    prefixes: ["double precision", "float8", "float"],
    schema: 's.number("float8")',
    db: "double precision",
  },
  {
    prefixes: ["numeric", "decimal"],
    schema: 's.number("numeric")',
    db: "numeric",
  },
  { prefixes: ["money"], schema: 's.number("money")', db: "money" },
  { prefixes: ["boolean", "bool"], schema: "s.boolean()", db: "boolean" },
  { prefixes: ["date"], schema: 's.string("date")', db: "date" },
  {
    prefixes: ["timestamptz"],
    schema: 's.string("timestamptz")',
    db: "timestamptz",
  },
  { prefixes: ["timestamp"], schema: 's.string("timestamp")', db: "timestamp" },
  { prefixes: ["time"], schema: 's.string("time")', db: "time" },
  { prefixes: ["interval"], schema: 's.string("interval")', db: "interval" },
  { prefixes: ["inet", "cidr"], schema: 's.string("inet")', db: "inet" },
  { prefixes: ["macaddr"], schema: 's.string("macaddr")', db: "macaddr" },
  {
    prefixes: ["point", "line", "lseg", "box", "path", "polygon", "circle"],
    schema: 's.any("geometry")',
    db: "geometry",
  },
];

export function getColumnType(type: string): { schema: string; db: string } {
  const normalized = type.toLowerCase().trim();

  if (normalized.endsWith("[]")) {
    const baseType = normalized.slice(0, -2).trim();
    const base = getColumnType(baseType);
    return { schema: `s.array(${base.schema})`, db: `${base.db}[]` };
  }

  for (const entry of TYPE_MAP) {
    if (entry.prefixes.some((p) => normalized.startsWith(p))) {
      return { schema: entry.schema, db: entry.db };
    }
  }

  return { schema: 's.any("unknown")', db: "unknown" };
}

const TABLE_REGEX = /CREATE TABLE\s+([\w"]+)\.([\w"]+)\s*\(([\s\S]+?)\);/gi;

const CONSTRAINT_PREFIXES = [
  "CONSTRAINT",
  "PRIMARY KEY",
  "FOREIGN KEY",
  "UNIQUE",
];

const COLUMN_REGEX =
  /^"?(\w+)"?\s+([a-zA-Z ]+(?:\(\d+\))?(?:\s+without time zone)?(?:\[\])?)(.*)$/i;

function isConstraintLine(line: string): boolean {
  const upper = line.toUpperCase();
  return CONSTRAINT_PREFIXES.some((p) => upper.startsWith(p));
}

function parseColumnLines(columnsRaw: string): string[] {
  return columnsRaw
    .split(/\r?\n/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && !isConstraintLine(c));
}

export type ParsedColumn = {
  name: string;
  schemaType: string;
  sqlType: string;
};

export type ParsedTable = {
  schema: string;
  table: string;
  columns: ParsedColumn[];
};

function parseColumnDefinition(
  col: string,
  schemaName: string,
  tableName: string,
  typings: Record<string, string>,
): ParsedColumn | null {
  const match = col.match(COLUMN_REGEX);
  if (!match) return null;

  const colName = match[1];
  const rawType = match[2].toLowerCase();
  const typingKey = `${schemaName}.${tableName}.${colName}`;
  const columnType = getColumnType(rawType);

  if (typings[typingKey]) {
    return {
      name: colName,
      schemaType: `typings["${typingKey}"].type`,
      sqlType: columnType.db,
    };
  }

  if (!col.includes("NOT NULL")) {
    columnType.schema = `s.nullable(${columnType.schema})`;
  }

  return {
    name: colName,
    schemaType: columnType.schema,
    sqlType: columnType.db,
  };
}

export function parseTables(
  sql: string,
  typings: Record<string, string>,
): ParsedTable[] {
  return [...sql.matchAll(TABLE_REGEX)].map((match) => {
    const schemaName = match[1].replace(/"/g, "");
    const tableName = match[2].replace(/"/g, "");
    const columnLines = parseColumnLines(match[3]);

    const columns = columnLines
      .map((col) => parseColumnDefinition(col, schemaName, tableName, typings))
      .filter((c): c is ParsedColumn => c !== null);

    return { schema: schemaName, table: tableName, columns };
  });
}
