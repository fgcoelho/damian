import { describe, expect, expectTypeOf, it } from "vitest";
import { type Prettify, s, typingsFactory } from "../src/index.js";

describe("Prettify<T>", () => {
  it("flattens an intersection type into a plain object type", () => {
    type Input = { a: string } & { b: number };
    type Result = Prettify<Input>;
    expectTypeOf<Result>().toEqualTypeOf<{ a: string; b: number }>();
  });
});

describe("typingsFactory", () => {
  it("creates a factory that returns custom typings with autocompletion", () => {
    const typings = typingsFactory<{
      public: {
        user: {
          id: any;
          name: any;
          role: any;
        };
        post: {
          id: any;
          title: any;
        };
      };
    }>();

    const customTypings = typings({
      public: {
        user: {
          role: {
            "~standard": {
              version: 1,
              vendor: "test",
              validate: (v: any) => ({ value: v as "admin" | "user" }),
            },
          },
        },
      },
    });

    expect(customTypings.public?.user?.role).toHaveProperty("~standard");
    expect((customTypings as any).public?.user?.id).toBeUndefined();
    expect((customTypings as any).public?.user?.name).toBeUndefined();
    expect((customTypings as any).public?.post).toBeUndefined();
  });

  it("returns empty object when no custom typings are provided", () => {
    const typings = typingsFactory<{
      public: {
        user: {
          id: any;
          email: any;
        };
      };
    }>();

    const result = typings({});

    expect(result).toEqual({});
  });
});

describe("s.externalSchema", () => {
  it("wraps an external validator with SQL type metadata", () => {
    const externalValidator = {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        validate: (value: any) => {
          if (value === "admin" || value === "user") {
            return { value: value as "admin" | "user" };
          }
          return { issues: [{ message: "Invalid role" }] };
        },
      },
    };

    const schema = s.externalSchema(externalValidator, "varchar");

    expect(schema.sqlType).toBe("varchar");
    expect(schema["~standard"]).toBe(externalValidator["~standard"]);

    const validResult = schema["~standard"].validate("admin");
    expect("value" in validResult && validResult.value).toBe("admin");

    const invalidResult = schema["~standard"].validate("invalid");
    expect("issues" in invalidResult).toBe(true);
  });
});
