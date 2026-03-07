import { describe, expect, it } from "vitest";
import { s } from "../../src/index";

describe("s.array", () => {
  it("derives sqlType from element schema by default", () => {
    const schema = s.array(s.string());
    expect(schema.sqlType).toBe("text[]");
  });

  it("accepts a custom sqlType", () => {
    const schema = s.array(s.string(), "varchar[]");
    expect(schema.sqlType).toBe("varchar[]");
  });

  it("validates an array value", () => {
    const schema = s.array(s.string());
    const result = schema["~standard"].validate(["a", "b"]);
    expect("value" in result && result.value).toEqual(["a", "b"]);
  });

  it("rejects a non-array value", () => {
    const schema = s.array(s.string());
    const result = schema["~standard"].validate("not-an-array");
    expect("issues" in result && result.issues?.[0].message).toBe(
      "Expected array, got string",
    );
  });
});
