import { describe, expect, it } from "vitest";
import { s } from "../../src/index";

describe("s.fromStandard", () => {
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

    const schema = s.fromStandard(externalValidator, "varchar");

    expect(schema.sqlType).toBe("varchar");
    expect(schema["~standard"]).toBe(externalValidator["~standard"]);

    const validResult = schema["~standard"].validate("admin");
    expect("value" in validResult && validResult.value).toBe("admin");

    const invalidResult = schema["~standard"].validate("invalid");
    expect("issues" in invalidResult).toBe(true);
  });
});
