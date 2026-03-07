import { describe, expect, it } from "vitest";
import { s } from "../../src/index";

describe("s.string", () => {
  it("defaults sqlType to 'text'", () => {
    const schema = s.string();
    expect(schema.sqlType).toBe("text");
  });

  it("accepts a custom sqlType", () => {
    const schema = s.string("varchar");
    expect(schema.sqlType).toBe("varchar");
  });

  it("validates a string value", () => {
    const schema = s.string();
    const result = schema["~standard"].validate("hello");
    expect("value" in result && result.value).toBe("hello");
  });

  it("rejects a non-string value", () => {
    const schema = s.string();
    const result = schema["~standard"].validate(42);
    expect("issues" in result && result.issues?.[0].message).toBe(
      "Expected string, got number",
    );
  });
});
