export type DbErrorCode =
  | "INVALID_SQL_TAG"
  | "EMPTY_EXCLUDED_COLUMNS"
  | "INVALID_SELECTION"
  | "ASYNC_VALIDATION_UNSUPPORTED"
  | "VALIDATION_FAILED"
  | "EMPTY_TUPLES"
  | "TABLE_ALIAS_SAME_AS_NAME";

export class DbError extends Error {
  readonly code: DbErrorCode;

  constructor(code: DbErrorCode, message: string) {
    super(message);
    this.name = "DbError";
    this.code = code;
  }
}
