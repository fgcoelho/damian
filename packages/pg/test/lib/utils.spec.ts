import { describe, expect, expectTypeOf, it } from "vitest";
import {
  type Prettify,
  SLONIK_FRAGMENT,
  SLONIK_IDENTIFIER,
} from "../../src/lib/utils";

describe("SLONIK_FRAGMENT", () => {
  it("is the well-known slonik fragment symbol", () => {
    expect(SLONIK_FRAGMENT).toBe(Symbol.for("SLONIK_TOKEN_FRAGMENT"));
  });
});

describe("SLONIK_IDENTIFIER", () => {
  it("is the well-known slonik identifier symbol", () => {
    expect(SLONIK_IDENTIFIER).toBe(Symbol.for("SLONIK_TOKEN_IDENTIFIER"));
  });
});

describe("Prettify<T>", () => {
  it("flattens an intersection type into a plain object type", () => {
    type Input = { a: string } & { b: number };
    type Result = Prettify<Input>;
    expectTypeOf<Result>().toEqualTypeOf<{ a: string; b: number }>();
  });
});
