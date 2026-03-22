export type OutputKind = "damian" | "drizzle";
export type OutputCasing = "snake" | "camel" | "preserve";

export type DamianOutputConfig = {
  kind: "damian";
  casing: OutputCasing;
};

export type DrizzleOutputConfig = {
  kind: "drizzle";
  casing: OutputCasing;
  isoTimestamp: boolean;
};

export type OutputConfig = DamianOutputConfig | DrizzleOutputConfig;

export type DatabaseColumn = {
  name: string;
  ordinalPosition: number;
  fullDataType: string;
  dataType: string;
  udtName: string;
  nullable: boolean;
  defaultValue: string | null;
  characterMaximumLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
  datetimePrecision: number | null;
};

export type PrimaryKeyConstraint = {
  name: string;
  columns: string[];
};

export type UniqueConstraint = {
  name: string;
  columns: string[];
};

export type ForeignKeyConstraint = {
  name: string;
  columns: string[];
  foreignSchema: string;
  foreignTable: string;
  foreignColumns: string[];
  onUpdate: string | null;
  onDelete: string | null;
};

export type DatabaseTable = {
  schema: string;
  table: string;
  columns: DatabaseColumn[];
  primaryKey: PrimaryKeyConstraint | null;
  uniqueConstraints: UniqueConstraint[];
  foreignKeys: ForeignKeyConstraint[];
};

export type DatabaseSchema = {
  tables: DatabaseTable[];
};

export type GeneratedArtifact = {
  fileName: string;
  content: string;
  format?: boolean;
};

export function getTableId(schema: string, table: string): string {
  return `${schema}.${table}`;
}
