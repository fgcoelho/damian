import { describe, expect, it } from "vitest";
import { s } from "../../src/index";

describe("s.boolean", () => {
  it("defaults sqlType to 'boolean'", () => {
    const schema = s.boolean();
    expect(schema.sqlType).toBe("boolean");
  });

  it("accepts a custom sqlType", () => {
    const schema = s.boolean("bool");
    expect(schema.sqlType).toBe("bool");
  });

  it("validates a boolean value", () => {
    const schema = s.boolean();
    const result = schema["~standard"].validate(true);
    expect("value" in result && result.value).toBe(true);
  });

  it("rejects a non-boolean value", () => {
    const schema = s.boolean();
    const result = schema["~standard"].validate("true");
    expect("issues" in result && result.issues?.[0].message).toBe(
      "Expected boolean, got string",
    );
  });
});
