import { describe, expect, it } from "vitest";
import { s } from "../../src/index";

describe("s.optional", () => {
  it("inherits sqlType from the wrapped schema", () => {
    const schema = s.optional(s.string("varchar"));
    expect(schema.sqlType).toBe("varchar");
  });

  it("returns undefined for undefined input", () => {
    const schema = s.optional(s.string());
    const result = schema["~standard"].validate(undefined);
    expect("value" in result && result.value).toBe(undefined);
  });

  it("returns undefined for null input", () => {
    const schema = s.optional(s.string());
    const result = schema["~standard"].validate(null);
    expect("value" in result && result.value).toBe(undefined);
  });

  it("delegates a valid value to the wrapped schema", () => {
    const schema = s.optional(s.string());
    const result = schema["~standard"].validate("hello");
    expect("value" in result && result.value).toBe("hello");
  });

  it("delegates an invalid value to the wrapped schema", () => {
    const schema = s.optional(s.string());
    const result = schema["~standard"].validate(42);
    expect("issues" in result).toBe(true);
  });
});
