import { describe, expect, it } from "vitest";
import { s } from "../../src/index";

describe("s.object", () => {
  it("defaults sqlType to 'jsonb'", () => {
    const schema = s.object({ id: s.string() });
    expect(schema.sqlType).toBe("jsonb");
  });

  it("accepts a custom sqlType", () => {
    const schema = s.object({ id: s.string() }, "json");
    expect(schema.sqlType).toBe("json");
  });

  it("validates a plain object", () => {
    const schema = s.object({ id: s.string() });
    const result = schema["~standard"].validate({ id: "1" });
    expect("value" in result && result.value).toEqual({ id: "1" });
  });

  it("rejects null", () => {
    const schema = s.object({ id: s.string() });
    const result = schema["~standard"].validate(null);
    expect("issues" in result).toBe(true);
  });

  it("rejects an array", () => {
    const schema = s.object({ id: s.string() });
    const result = schema["~standard"].validate([]);
    expect("issues" in result).toBe(true);
  });

  it("rejects a non-object value", () => {
    const schema = s.object({ id: s.string() });
    const result = schema["~standard"].validate("not-an-object");
    expect("issues" in result && result.issues?.[0].message).toBe(
      "Expected object, got string",
    );
  });
});
