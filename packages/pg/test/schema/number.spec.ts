import { describe, expect, it } from "vitest";
import { s } from "../../src/index";

describe("s.number", () => {
  it("defaults sqlType to 'integer'", () => {
    const schema = s.number();
    expect(schema.sqlType).toBe("integer");
  });

  it("accepts a custom sqlType", () => {
    const schema = s.number("int4");
    expect(schema.sqlType).toBe("int4");
  });

  it("validates a number value", () => {
    const schema = s.number();
    const result = schema["~standard"].validate(42);
    expect("value" in result && result.value).toBe(42);
  });

  it("rejects a non-number value", () => {
    const schema = s.number();
    const result = schema["~standard"].validate("hello");
    expect("issues" in result && result.issues?.[0].message).toBe(
      "Expected number, got string",
    );
  });
});
