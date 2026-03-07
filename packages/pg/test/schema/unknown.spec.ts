import { describe, expect, it } from "vitest";
import { s } from "../../src/index";

describe("s.unknown", () => {
  it("defaults sqlType to 'jsonb'", () => {
    const schema = s.unknown();
    expect(schema.sqlType).toBe("jsonb");
  });

  it("accepts a custom sqlType", () => {
    const schema = s.unknown("text");
    expect(schema.sqlType).toBe("text");
  });

  it("passes a string value through", () => {
    const schema = s.unknown();
    const result = schema["~standard"].validate("anything");
    expect("value" in result && result.value).toBe("anything");
  });

  it("passes a number value through", () => {
    const schema = s.unknown();
    const result = schema["~standard"].validate(42);
    expect("value" in result && result.value).toBe(42);
  });

  it("passes null through", () => {
    const schema = s.unknown();
    const result = schema["~standard"].validate(null);
    expect("value" in result).toBe(true);
  });

  it("passes undefined through", () => {
    const schema = s.unknown();
    const result = schema["~standard"].validate(undefined);
    expect("value" in result).toBe(true);
  });
});
