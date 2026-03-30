import Case from "case";
import {
  type DatabaseColumn,
  type DatabaseSchema,
  type DatabaseTable,
  type DrizzleOutputConfig,
  getTableId,
  type OutputCasing,
} from "../helpers/schema-model";
import { capitalize } from "./damian-output";

type DrizzleColumnBuilder = {
  importName: string;
  call: string;
  isSerial: boolean;
};

type DrizzleRenderContext = {
  imports: Set<string>;
  usesSql: boolean;
  usesRawTimestamp: boolean;
  tableConstById: Map<string, string>;
  schemaConstByName: Map<string, string>;
  tableOrderById: Map<string, number>;
  foreignKeyTargetsByTableId: Map<string, Set<string>>;
};

const JS_IDENTIFIER_REGEX = /^[A-Za-z_$][\w$]*$/;

function isValidIdentifier(value: string): boolean {
  return JS_IDENTIFIER_REGEX.test(value);
}

function quoteString(value: string): string {
  return JSON.stringify(value);
}

function toPropertyAccess(path: string[]): string {
  return path
    .map((part, index) => {
      if (index === 0 && isValidIdentifier(part)) {
        return part;
      }
      if (isValidIdentifier(part)) {
        return `.${part}`;
      }
      return `[${quoteString(part)}]`;
    })
    .join("");
}

function normalizeIdentifier(value: string): string {
  const normalized = Case.camel(value).replace(/[^A-Za-z0-9_$]/g, "");
  if (normalized.length === 0) return "generated";
  return /^[0-9]/.test(normalized) ? `_${normalized}` : normalized;
}

function applyOutputCasing(value: string, outputCasing: OutputCasing): string {
  if (outputCasing === "camel") return Case.camel(value);
  if (outputCasing === "snake") return Case.snake(value);
  return value;
}

function getColumnPropertyName(
  columnName: string,
  outputCasing: OutputCasing,
): string {
  return applyOutputCasing(columnName, outputCasing);
}

function renderObjectKey(key: string): string {
  return isValidIdentifier(key) ? key : quoteString(key);
}

function renderPropertyAccess(target: string, key: string): string {
  return isValidIdentifier(key)
    ? `${target}.${key}`
    : `${target}[${quoteString(key)}]`;
}

function buildTableConstNames(tables: DatabaseTable[]): Map<string, string> {
  const rawNames = tables.map((table) => capitalize(Case.camel(table.table)));
  const duplicates = new Set<string>();
  const seen = new Set<string>();

  for (const name of rawNames) {
    if (seen.has(name)) {
      duplicates.add(name);
      continue;
    }
    seen.add(name);
  }

  const result = new Map<string, string>();

  for (const table of tables) {
    const baseName = capitalize(Case.camel(table.table));
    const uniqueBase = duplicates.has(baseName)
      ? `${capitalize(Case.camel(table.schema))}${baseName}`
      : baseName;
    result.set(getTableId(table.schema, table.table), `${uniqueBase}Table`);
  }

  return result;
}

function buildSchemaConstNames(tables: DatabaseTable[]): Map<string, string> {
  const schemas = [...new Set(tables.map((table) => table.schema))].filter(
    (schema) => schema !== "public",
  );

  return new Map(
    schemas.map((schema) => [schema, `${normalizeIdentifier(schema)}Schema`]),
  );
}

function sortTablesByDependencies(tables: DatabaseTable[]): DatabaseTable[] {
  const byId = new Map(
    tables.map((table) => [getTableId(table.schema, table.table), table]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const sorted: DatabaseTable[] = [];

  function visit(table: DatabaseTable): void {
    const tableId = getTableId(table.schema, table.table);
    if (visited.has(tableId) || visiting.has(tableId)) return;

    visiting.add(tableId);

    for (const foreignKey of table.foreignKeys) {
      const dependency = byId.get(
        getTableId(foreignKey.foreignSchema, foreignKey.foreignTable),
      );
      if (!dependency || dependency === table) continue;
      visit(dependency);
    }

    visiting.delete(tableId);
    visited.add(tableId);
    sorted.push(table);
  }

  for (const table of tables) {
    visit(table);
  }

  return sorted;
}

function buildTableOrderById(tables: DatabaseTable[]): Map<string, number> {
  return new Map(
    tables.map((table, index) => [
      getTableId(table.schema, table.table),
      index,
    ]),
  );
}

function buildForeignKeyTargetsByTableId(
  tables: DatabaseTable[],
): Map<string, Set<string>> {
  return new Map(
    tables.map((table) => [
      getTableId(table.schema, table.table),
      new Set(
        table.foreignKeys.map((foreignKey) =>
          getTableId(foreignKey.foreignSchema, foreignKey.foreignTable),
        ),
      ),
    ]),
  );
}

function isSerialColumn(column: DatabaseColumn): boolean {
  if (!column.defaultValue?.startsWith("nextval(")) return false;

  const normalized = column.fullDataType.toLowerCase();
  return (
    normalized === "integer" ||
    normalized === "bigint" ||
    normalized === "smallint"
  );
}

function baseTypeName(column: DatabaseColumn): string {
  const normalized = column.fullDataType.toLowerCase();
  if (normalized.endsWith("[]")) {
    return normalized.slice(0, -2).trim();
  }
  return normalized;
}

function parseBitLength(type: string): number | null {
  const match = type.match(/\((\d+)\)/);
  if (!match) return null;
  return Number(match[1]);
}

function buildTimestampConfig(column: DatabaseColumn): string | null {
  const parts: string[] = [];
  const type = baseTypeName(column);

  if (type.includes("with time zone") || type === "timestamptz") {
    parts.push("withTimezone: true");
  }
  if (column.datetimePrecision !== null) {
    parts.push(`precision: ${column.datetimePrecision}`);
  }

  if (parts.length === 0) return null;
  return `{ ${parts.join(", ")} }`;
}

function buildIsoTimestampConfig(column: DatabaseColumn): string {
  const parts: string[] = [];

  if (column.datetimePrecision !== null) {
    parts.push(`precision: ${column.datetimePrecision}`);
  }

  return `{ ${parts.join(", ")} }`;
}

function buildTimeConfig(column: DatabaseColumn): string | null {
  const parts: string[] = [];
  const type = baseTypeName(column);

  if (type.includes("with time zone")) {
    parts.push("withTimezone: true");
  }
  if (column.datetimePrecision !== null) {
    parts.push(`precision: ${column.datetimePrecision}`);
  }

  if (parts.length === 0) return null;
  return `{ ${parts.join(", ")} }`;
}

function buildDrizzleColumnBuilder(
  column: DatabaseColumn,
  drizzleConfig: DrizzleOutputConfig,
  context: DrizzleRenderContext,
): DrizzleColumnBuilder {
  if (isSerialColumn(column)) {
    const type = baseTypeName(column);
    if (type === "bigint") {
      return {
        importName: "bigserial",
        call: `bigserial(${quoteString(column.name)}, { mode: 'number' })`,
        isSerial: true,
      };
    }

    if (type === "smallint") {
      return {
        importName: "smallserial",
        call: `smallserial(${quoteString(column.name)})`,
        isSerial: true,
      };
    }

    return {
      importName: "serial",
      call: `serial(${quoteString(column.name)})`,
      isSerial: true,
    };
  }

  const isArray = column.fullDataType.toLowerCase().endsWith("[]");
  const type = baseTypeName(column);

  let builder: DrizzleColumnBuilder;

  if (type.startsWith("character varying") || type.startsWith("varchar")) {
    const length = column.characterMaximumLength;
    builder = {
      importName: "varchar",
      call:
        length === null
          ? `varchar(${quoteString(column.name)})`
          : `varchar(${quoteString(column.name)}, { length: ${length} })`,
      isSerial: false,
    };
  } else if (type.startsWith("character") || type.startsWith("char")) {
    const length = column.characterMaximumLength;
    builder = {
      importName: "char",
      call:
        length === null
          ? `char(${quoteString(column.name)})`
          : `char(${quoteString(column.name)}, { length: ${length} })`,
      isSerial: false,
    };
  } else if (type === "uuid") {
    builder = {
      importName: "uuid",
      call: `uuid(${quoteString(column.name)})`,
      isSerial: false,
    };
  } else if (type === "text") {
    builder = {
      importName: "text",
      call: `text(${quoteString(column.name)})`,
      isSerial: false,
    };
  } else if (type === "jsonb") {
    builder = {
      importName: "jsonb",
      call: `jsonb(${quoteString(column.name)})`,
      isSerial: false,
    };
  } else if (type === "json") {
    builder = {
      importName: "json",
      call: `json(${quoteString(column.name)})`,
      isSerial: false,
    };
  } else if (type === "bigint") {
    builder = {
      importName: "bigint",
      call: `bigint(${quoteString(column.name)}, { mode: 'number' })`,
      isSerial: false,
    };
  } else if (type === "integer" || type === "int" || type === "int4") {
    builder = {
      importName: "integer",
      call: `integer(${quoteString(column.name)})`,
      isSerial: false,
    };
  } else if (type === "smallint" || type === "int2") {
    builder = {
      importName: "smallint",
      call: `smallint(${quoteString(column.name)})`,
      isSerial: false,
    };
  } else if (type === "boolean" || type === "bool") {
    builder = {
      importName: "boolean",
      call: `boolean(${quoteString(column.name)})`,
      isSerial: false,
    };
  } else if (type === "date") {
    builder = {
      importName: "date",
      call: `date(${quoteString(column.name)})`,
      isSerial: false,
    };
  } else if (type.startsWith("timestamp") || type === "timestamptz") {
    if (drizzleConfig.isoTimestamp) {
      context.imports.add("customType");
      context.usesRawTimestamp = true;
      builder = {
        importName: "customType",
        call: `isoTimestamp(${quoteString(column.name)}, ${buildIsoTimestampConfig(column)})`,
        isSerial: false,
      };
    } else {
      const config = buildTimestampConfig(column);
      builder = {
        importName: "timestamp",
        call: config
          ? `timestamp(${quoteString(column.name)}, ${config})`
          : `timestamp(${quoteString(column.name)})`,
        isSerial: false,
      };
    }
  } else if (type.startsWith("time")) {
    const config = buildTimeConfig(column);
    builder = {
      importName: "time",
      call: config
        ? `time(${quoteString(column.name)}, ${config})`
        : `time(${quoteString(column.name)})`,
      isSerial: false,
    };
  } else if (type.startsWith("numeric") || type.startsWith("decimal")) {
    const options: string[] = [];
    if (column.numericPrecision !== null) {
      options.push(`precision: ${column.numericPrecision}`);
    }
    if (column.numericScale !== null) {
      options.push(`scale: ${column.numericScale}`);
    }
    builder = {
      importName: "numeric",
      call:
        options.length === 0
          ? `numeric(${quoteString(column.name)})`
          : `numeric(${quoteString(column.name)}, { ${options.join(", ")} })`,
      isSerial: false,
    };
  } else if (type === "real" || type === "float4") {
    builder = {
      importName: "real",
      call: `real(${quoteString(column.name)})`,
      isSerial: false,
    };
  } else if (
    type === "double precision" ||
    type === "float8" ||
    type === "float"
  ) {
    builder = {
      importName: "doublePrecision",
      call: `doublePrecision(${quoteString(column.name)})`,
      isSerial: false,
    };
  } else if (type === "inet") {
    builder = {
      importName: "inet",
      call: `inet(${quoteString(column.name)})`,
      isSerial: false,
    };
  } else if (type === "cidr") {
    builder = {
      importName: "cidr",
      call: `cidr(${quoteString(column.name)})`,
      isSerial: false,
    };
  } else if (type === "macaddr") {
    builder = {
      importName: "macaddr",
      call: `macaddr(${quoteString(column.name)})`,
      isSerial: false,
    };
  } else if (type === "macaddr8") {
    builder = {
      importName: "macaddr8",
      call: `macaddr8(${quoteString(column.name)})`,
      isSerial: false,
    };
  } else if (type.startsWith("interval")) {
    builder = {
      importName: "interval",
      call: `interval(${quoteString(column.name)})`,
      isSerial: false,
    };
  } else if (type.startsWith("bit varying") || type.startsWith("varbit")) {
    const dimensions = parseBitLength(type);
    builder = {
      importName: "varbit",
      call:
        dimensions === null
          ? `varbit(${quoteString(column.name)})`
          : `varbit(${quoteString(column.name)}, { dimensions: ${dimensions} })`,
      isSerial: false,
    };
  } else if (type.startsWith("bit")) {
    const dimensions = parseBitLength(type);
    builder = {
      importName: "bit",
      call:
        dimensions === null
          ? `bit(${quoteString(column.name)})`
          : `bit(${quoteString(column.name)}, { dimensions: ${dimensions} })`,
      isSerial: false,
    };
  } else {
    builder = {
      importName: "text",
      call: `text(${quoteString(column.name)})`,
      isSerial: false,
    };
  }

  if (!isArray) {
    return builder;
  }

  return {
    ...builder,
    call: `${builder.call}.array()`,
  };
}

function escapeTemplateLiteral(value: string): string {
  return value.replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function stripTypeCast(value: string): string {
  return value.replace(/::[\w\s[\]"]+$/g, "").trim();
}

function unwrapSqlStringLiteral(value: string): string | null {
  if (!value.startsWith("'") || !value.endsWith("'")) return null;
  return value.slice(1, -1).replace(/''/g, "'");
}

function shouldParseArrayAsNumbers(type: string): boolean {
  return [
    "smallint",
    "integer",
    "int",
    "int2",
    "int4",
    "bigint",
    "real",
    "float4",
    "float8",
    "float",
    "double precision",
  ].includes(type);
}

function parsePgArrayLiteral(literal: string): Array<string | null> | null {
  if (!literal.startsWith("{") || !literal.endsWith("}")) return null;

  const inner = literal.slice(1, -1);
  if (inner.length === 0) return [];

  const values: Array<string | null> = [];
  let current = "";
  let inQuotes = false;
  let escaping = false;

  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];

    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current === "NULL" ? null : current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current === "NULL" ? null : current);
  return values;
}

function buildTypedLiteral(
  value: unknown,
  typingTypeReference: string | null,
): string {
  const literal = JSON.stringify(value);
  if (!typingTypeReference) return literal;
  return `${literal} as ${typingTypeReference}`;
}

function parseArrayDefaultLiteral(
  column: DatabaseColumn,
  typingTypeReference: string | null,
): string | null {
  const literal = unwrapSqlStringLiteral(
    stripTypeCast(column.defaultValue ?? ""),
  );
  if (literal === null) return null;

  const values = parsePgArrayLiteral(literal);
  if (!values || values.some((value) => value === null)) return null;

  const type = baseTypeName(column);
  const parsedValues = values.map((value) => {
    if (shouldParseArrayAsNumbers(type)) {
      return Number(value);
    }

    if (type === "boolean" || type === "bool") {
      return value === "t" || value === "true";
    }

    return value;
  });

  return buildTypedLiteral(parsedValues, typingTypeReference);
}

function parseJsonDefaultLiteral(
  column: DatabaseColumn,
  typingTypeReference: string | null,
): string | null {
  const normalized = stripTypeCast(column.defaultValue ?? "");
  const raw = unwrapSqlStringLiteral(normalized) ?? normalized;

  if (!raw.startsWith("{") && !raw.startsWith("[")) return null;

  try {
    return buildTypedLiteral(JSON.parse(raw), typingTypeReference);
  } catch {
    return null;
  }
}

function buildTypingTypeReference(
  table: DatabaseTable,
  column: DatabaseColumn,
): string {
  const path = toPropertyAccess([
    "typings",
    table.schema,
    table.table,
    column.name,
  ]);
  return `InferTypingOutput<typeof ${path}>`;
}

function hasPath(
  targetsByTableId: Map<string, Set<string>>,
  fromTableId: string,
  toTableId: string,
): boolean {
  const visited = new Set<string>();
  const stack = [fromTableId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    if (current === toTableId) return true;
    visited.add(current);

    for (const target of targetsByTableId.get(current) ?? []) {
      if (!visited.has(target)) {
        stack.push(target);
      }
    }
  }

  return false;
}

function isCyclicForeignKey(
  table: DatabaseTable,
  foreignKey: DatabaseTable["foreignKeys"][number],
  context: DrizzleRenderContext,
): boolean {
  const sourceTableId = getTableId(table.schema, table.table);
  const targetTableId = getTableId(
    foreignKey.foreignSchema,
    foreignKey.foreignTable,
  );

  if (sourceTableId === targetTableId) return true;
  return hasPath(
    context.foreignKeyTargetsByTableId,
    targetTableId,
    sourceTableId,
  );
}

function shouldInlineForeignKey(
  table: DatabaseTable,
  foreignKey: DatabaseTable["foreignKeys"][number],
  inlineForeignKeys: Map<string, DatabaseTable["foreignKeys"][number]>,
  context: DrizzleRenderContext,
): boolean {
  if (
    foreignKey.columns.length !== 1 ||
    foreignKey.foreignColumns.length !== 1 ||
    inlineForeignKeys.get(foreignKey.columns[0]) !== foreignKey
  ) {
    return false;
  }

  if (!isCyclicForeignKey(table, foreignKey, context)) {
    return true;
  }

  const sourceTableId = getTableId(table.schema, table.table);
  const targetTableId = getTableId(
    foreignKey.foreignSchema,
    foreignKey.foreignTable,
  );

  if (sourceTableId === targetTableId) {
    return true;
  }

  const sourceOrder = context.tableOrderById.get(sourceTableId) ?? 0;
  const targetOrder = context.tableOrderById.get(targetTableId) ?? 0;
  return targetOrder < sourceOrder;
}

function buildDefaultChain(
  column: DatabaseColumn,
  context: DrizzleRenderContext,
  drizzleConfig: DrizzleOutputConfig,
  typingTypeReference: string | null,
): string | null {
  if (column.defaultValue === null || isSerialColumn(column)) return null;

  const normalized = stripTypeCast(column.defaultValue);
  const lower = normalized.toLowerCase();
  const type = baseTypeName(column);

  if (column.fullDataType.toLowerCase().endsWith("[]")) {
    const parsedArray = parseArrayDefaultLiteral(column, typingTypeReference);
    if (parsedArray !== null) {
      return `.default(${parsedArray})`;
    }
  }

  if (type === "json" || type === "jsonb") {
    const parsedJson = parseJsonDefaultLiteral(column, typingTypeReference);
    if (parsedJson !== null) {
      return `.default(${parsedJson})`;
    }
  }

  if (lower === "now()" || lower === "current_timestamp") {
    if (
      type.startsWith("timestamp") ||
      type.startsWith("time") ||
      type === "date"
    ) {
      if (drizzleConfig.isoTimestamp && type.startsWith("timestamp")) {
        context.imports.add("sql");
        context.usesSql = true;
        return ".default(sql`now()`)";
      }
      return ".defaultNow()";
    }
  }

  if (lower === "true" || lower === "false") {
    return `.default(${typingTypeReference ? `${lower} as ${typingTypeReference}` : lower})`;
  }

  if (/^-?\d+$/.test(normalized)) {
    return `.default(${typingTypeReference ? `${normalized} as ${typingTypeReference}` : normalized})`;
  }

  if (/^-?\d+\.\d+$/.test(normalized)) {
    if (type.startsWith("numeric") || type.startsWith("decimal")) {
      return `.default(${typingTypeReference ? `${quoteString(normalized)} as ${typingTypeReference}` : quoteString(normalized)})`;
    }
    return `.default(${typingTypeReference ? `${normalized} as ${typingTypeReference}` : normalized})`;
  }

  if (normalized.startsWith("'") && normalized.endsWith("'")) {
    return `.default(${typingTypeReference ? `${normalized} as ${typingTypeReference}` : normalized})`;
  }

  context.imports.add("sql");
  context.usesSql = true;
  return `.default(sql\`${escapeTemplateLiteral(column.defaultValue)}\`)`;
}

function buildInlineForeignKeyMap(
  table: DatabaseTable,
): Map<string, DatabaseTable["foreignKeys"][number]> {
  const byColumn = new Map<string, DatabaseTable["foreignKeys"][number]>();

  for (const foreignKey of table.foreignKeys) {
    if (
      foreignKey.columns.length !== 1 ||
      foreignKey.foreignColumns.length !== 1
    ) {
      continue;
    }

    const columnName = foreignKey.columns[0];
    if (byColumn.has(columnName)) continue;
    byColumn.set(columnName, foreignKey);
  }

  return byColumn;
}

function buildInlineForeignKeyChain(
  table: DatabaseTable,
  foreignKey: DatabaseTable["foreignKeys"][number],
  context: DrizzleRenderContext,
  outputCasing: OutputCasing,
): string {
  const targetTable = context.tableConstById.get(
    getTableId(foreignKey.foreignSchema, foreignKey.foreignTable),
  );

  if (!targetTable) return "";

  const targetColumn = getColumnPropertyName(
    foreignKey.foreignColumns[0],
    outputCasing,
  );
  const isAnnotatedReference = isCyclicForeignKey(table, foreignKey, context);
  if (isAnnotatedReference) {
    context.imports.add("type AnyPgColumn");
  }
  const options: string[] = [];
  if (foreignKey.onDelete && foreignKey.onDelete !== "no action") {
    options.push(`onDelete: ${quoteString(foreignKey.onDelete)}`);
  }
  if (foreignKey.onUpdate && foreignKey.onUpdate !== "no action") {
    options.push(`onUpdate: ${quoteString(foreignKey.onUpdate)}`);
  }

  if (options.length === 0) {
    return isAnnotatedReference
      ? `.references((): AnyPgColumn => ${renderPropertyAccess(targetTable, targetColumn)})`
      : `.references(() => ${renderPropertyAccess(targetTable, targetColumn)})`;
  }

  return isAnnotatedReference
    ? `.references((): AnyPgColumn => ${renderPropertyAccess(targetTable, targetColumn)}, { ${options.join(", ")} })`
    : `.references(() => ${renderPropertyAccess(targetTable, targetColumn)}, { ${options.join(", ")} })`;
}

function buildTypingChain(
  table: DatabaseTable,
  column: DatabaseColumn,
): string {
  return `.$type<${buildTypingTypeReference(table, column)}>()`;
}

function buildColumnDefinition(
  table: DatabaseTable,
  column: DatabaseColumn,
  context: DrizzleRenderContext,
  drizzleConfig: DrizzleOutputConfig,
  customTypings: Record<string, string>,
  inlineForeignKeys: Map<string, DatabaseTable["foreignKeys"][number]>,
  outputCasing: OutputCasing,
): string {
  const builder = buildDrizzleColumnBuilder(column, drizzleConfig, context);
  context.imports.add(builder.importName);

  const key = `${table.schema}.${table.table}.${column.name}`;
  const propertyName = getColumnPropertyName(column.name, outputCasing);
  const typingTypeReference = customTypings[key]
    ? buildTypingTypeReference(table, column)
    : null;
  let definition = builder.call;

  if (customTypings[key]) {
    definition += buildTypingChain(table, column);
  }

  if (!column.nullable) {
    definition += ".notNull()";
  }

  const isSingleColumnPrimaryKey =
    table.primaryKey?.columns.length === 1 &&
    table.primaryKey.columns[0] === column.name;
  if (isSingleColumnPrimaryKey) {
    definition += ".primaryKey()";
  }

  definition +=
    buildDefaultChain(column, context, drizzleConfig, typingTypeReference) ??
    "";

  const inlineForeignKey = inlineForeignKeys.get(column.name);
  if (
    inlineForeignKey &&
    shouldInlineForeignKey(table, inlineForeignKey, inlineForeignKeys, context)
  ) {
    definition += buildInlineForeignKeyChain(
      table,
      inlineForeignKey,
      context,
      outputCasing,
    );
  }

  return `  ${renderObjectKey(propertyName)}: ${definition},`;
}

function buildConstraintEntries(
  table: DatabaseTable,
  context: DrizzleRenderContext,
  inlineForeignKeys: Map<string, DatabaseTable["foreignKeys"][number]>,
  outputCasing: OutputCasing,
): string[] {
  const entries: string[] = [];

  if (table.primaryKey && table.primaryKey.columns.length > 1) {
    context.imports.add("primaryKey");
    const columns = table.primaryKey.columns
      .map((column) =>
        renderPropertyAccess(
          "table",
          getColumnPropertyName(column, outputCasing),
        ),
      )
      .join(", ");
    entries.push(
      `  primaryKey({ name: ${quoteString(table.primaryKey.name)}, columns: [${columns}] }),`,
    );
  }

  for (const constraint of table.uniqueConstraints) {
    context.imports.add("unique");
    const columns = constraint.columns
      .map((column) =>
        renderPropertyAccess(
          "table",
          getColumnPropertyName(column, outputCasing),
        ),
      )
      .join(", ");
    entries.push(`  unique(${quoteString(constraint.name)}).on(${columns}),`);
  }

  for (const foreignKey of table.foreignKeys) {
    const isInline = shouldInlineForeignKey(
      table,
      foreignKey,
      inlineForeignKeys,
      context,
    );
    if (isInline) continue;

    const targetTable = context.tableConstById.get(
      getTableId(foreignKey.foreignSchema, foreignKey.foreignTable),
    );
    if (!targetTable) continue;

    context.imports.add("foreignKey");
    const columns = foreignKey.columns
      .map((column) =>
        renderPropertyAccess(
          "table",
          getColumnPropertyName(column, outputCasing),
        ),
      )
      .join(", ");
    const foreignColumns = foreignKey.foreignColumns
      .map((column) =>
        renderPropertyAccess(
          targetTable,
          getColumnPropertyName(column, outputCasing),
        ),
      )
      .join(", ");
    let entry = `  foreignKey({ name: ${quoteString(foreignKey.name)}, columns: [${columns}], foreignColumns: [${foreignColumns}] })`;
    if (foreignKey.onUpdate && foreignKey.onUpdate !== "no action") {
      entry += `.onUpdate(${quoteString(foreignKey.onUpdate)})`;
    }
    if (foreignKey.onDelete && foreignKey.onDelete !== "no action") {
      entry += `.onDelete(${quoteString(foreignKey.onDelete)})`;
    }
    entry += ",";
    entries.push(entry);
  }

  return entries;
}

function buildTableFactory(
  table: DatabaseTable,
  context: DrizzleRenderContext,
): string {
  if (table.schema === "public") {
    context.imports.add("pgTable");
    return "pgTable";
  }

  context.imports.add("pgSchema");
  return `${context.schemaConstByName.get(table.schema)}.table`;
}

function buildTableBlock(
  table: DatabaseTable,
  context: DrizzleRenderContext,
  drizzleConfig: DrizzleOutputConfig,
  customTypings: Record<string, string>,
  outputCasing: OutputCasing,
): string {
  const tableConst = context.tableConstById.get(
    getTableId(table.schema, table.table),
  );
  if (!tableConst) {
    throw new Error(
      `Missing table constant for ${table.schema}.${table.table}`,
    );
  }

  const inlineForeignKeys = buildInlineForeignKeyMap(table);
  const columnLines = table.columns.map((column) =>
    buildColumnDefinition(
      table,
      column,
      context,
      drizzleConfig,
      customTypings,
      inlineForeignKeys,
      outputCasing,
    ),
  );
  const constraintEntries = buildConstraintEntries(
    table,
    context,
    inlineForeignKeys,
    outputCasing,
  );
  const factory = buildTableFactory(table, context);

  if (constraintEntries.length === 0) {
    return `export const ${tableConst} = ${factory}(${quoteString(table.table)}, {\n${columnLines.join("\n")}\n});`;
  }

  return `export const ${tableConst} = ${factory}(${quoteString(table.table)}, {\n${columnLines.join("\n")}\n}, (table) => [\n${constraintEntries.join("\n")}\n]);`;
}

export function generateDrizzleTablesOutput(
  schema: DatabaseSchema,
  customTypings: Record<string, string>,
  drizzleConfig: DrizzleOutputConfig = {
    kind: "drizzle",
    casing: "preserve",
    isoTimestamp: false,
  },
): string {
  const outputCasing = drizzleConfig.casing;
  const sortedTables = sortTablesByDependencies(schema.tables);
  const context: DrizzleRenderContext = {
    imports: new Set<string>(),
    usesSql: false,
    usesRawTimestamp: false,
    tableConstById: buildTableConstNames(sortedTables),
    schemaConstByName: buildSchemaConstNames(sortedTables),
    tableOrderById: buildTableOrderById(sortedTables),
    foreignKeyTargetsByTableId: buildForeignKeyTargetsByTableId(sortedTables),
  };

  const hasCustomTypings = Object.keys(customTypings).length > 0;
  const schemaDeclarations = [...context.schemaConstByName.entries()].map(
    ([schemaName, schemaConst]) =>
      `const ${schemaConst} = pgSchema(${quoteString(schemaName)});`,
  );
  const tableBlocks = sortedTables.map((table) =>
    buildTableBlock(table, context, drizzleConfig, customTypings, outputCasing),
  );
  const helperLines = hasCustomTypings
    ? [
        "type StandardSchemaLike = {",
        `  readonly ${quoteString("~standard")}: {`,
        "    readonly types?: {",
        "      readonly output: unknown;",
        "    };",
        "  };",
        "};",
        `type InferTypingOutput<T extends StandardSchemaLike> = NonNullable<T[${quoteString("~standard")}]["types"]>["output"];`,
      ]
    : [];
  const rawTimestampLines = context.usesRawTimestamp
    ? [
        "const isoTimestamp = customType<{",
        "  data: string;",
        "  driverData: string;",
        "  config: { precision?: number };",
        "}>({",
        "  dataType(config) {",
        `    const precision = typeof config?.precision !== 'undefined' ? \` (\${config.precision})\` : '';`,
        `    return \`timestamp\${precision} with time zone\`;`,
        "  },",
        "  fromDriver(value: string) {",
        `    const normalized = value.endsWith('Z') ? value : \`\${value}Z\`;`,
        "    return new Date(normalized).toISOString();",
        "  },",
        "});",
      ]
    : [];

  const importList = [...context.imports].sort();
  const pgCoreImports = importList.filter((item) => item !== "sql");
  const lines = [
    "// This file is auto-generated from the database schema. Do not edit directly.",
    `import { ${pgCoreImports.join(", ")} } from 'drizzle-orm/pg-core';`,
  ];

  if (context.usesSql) {
    lines.push("import { sql } from 'drizzle-orm';");
  }

  if (hasCustomTypings) {
    lines.push("import typings from '../typings';");
  }

  lines.push("");

  if (helperLines.length > 0) {
    lines.push(...helperLines, "");
  }

  if (rawTimestampLines.length > 0) {
    lines.push(...rawTimestampLines, "");
  }

  if (schemaDeclarations.length > 0) {
    lines.push(...schemaDeclarations, "");
  }

  lines.push(...tableBlocks, "");

  return lines.join("\n");
}
