import type { StandardSchemaV1 } from "@standard-schema/spec";

export type Schema<T> = StandardSchemaV1<T> & {
  sqlType: string;
};

export function string(sqlType: string = "text"): Schema<string> {
  return {
    sqlType,
    "~standard": {
      version: 1,
      vendor: "damiandb",
      validate: (value) => {
        if (typeof value === "string") {
          return { value };
        }
        return {
          issues: [{ message: `Expected string, got ${typeof value}` }],
        };
      },
    },
  };
}

export function number(sqlType: string = "integer"): Schema<number> {
  return {
    sqlType,
    "~standard": {
      version: 1,
      vendor: "damiandb",
      validate: (value) => {
        if (typeof value === "number") {
          return { value };
        }
        return {
          issues: [{ message: `Expected number, got ${typeof value}` }],
        };
      },
    },
  };
}

export function boolean(sqlType: string = "boolean"): Schema<boolean> {
  return {
    sqlType,
    "~standard": {
      version: 1,
      vendor: "damiandb",
      validate: (value) => {
        if (typeof value === "boolean") {
          return { value };
        }
        return {
          issues: [{ message: `Expected boolean, got ${typeof value}` }],
        };
      },
    },
  };
}

export function optional<T>(schema: Schema<T>): Schema<T | undefined> {
  return {
    sqlType: schema.sqlType,
    "~standard": {
      version: 1,
      vendor: "damiandb",
      validate: (value) => {
        if (value === undefined || value === null) {
          return { value: undefined as T | undefined };
        }
        return schema["~standard"].validate(value);
      },
    },
  };
}

export function nullable<T>(schema: Schema<T>): Schema<T | null> {
  return {
    sqlType: schema.sqlType,
    "~standard": {
      version: 1,
      vendor: "damiandb",
      validate: (value) => {
        if (value === null || value === undefined) {
          return { value: null as T | null };
        }
        return schema["~standard"].validate(value);
      },
    },
  };
}

export function array<T>(
  elementSchema: Schema<T>,
  sqlType?: string,
): Schema<T[]> {
  return {
    sqlType: sqlType || `${elementSchema.sqlType}[]`,
    "~standard": {
      version: 1,
      vendor: "damiandb",
      validate: (value) => {
        if (Array.isArray(value)) {
          return { value: value as T[] };
        }
        return {
          issues: [{ message: `Expected array, got ${typeof value}` }],
        };
      },
    },
  };
}

export function any(sqlType: string = "jsonb"): Schema<any> {
  return {
    sqlType,
    "~standard": {
      version: 1,
      vendor: "damiandb",
      validate: (value) => {
        return { value };
      },
    },
  };
}

export function object<T extends Record<string, any>>(
  shape: { [K in keyof T]: StandardSchemaV1<T[K]> },
  sqlType: string = "jsonb",
): Schema<T> {
  return {
    sqlType,
    "~standard": {
      version: 1,
      vendor: "damiandb",
      validate: (value) => {
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          return { value: value as T };
        }
        return {
          issues: [{ message: `Expected object, got ${typeof value}` }],
        };
      },
    },
  };
}

export function externalSchema<T>(
  externalValidator: StandardSchemaV1<T>,
  sqlType: string,
): Schema<T> {
  return {
    sqlType,
    "~standard": externalValidator["~standard"],
  };
}
