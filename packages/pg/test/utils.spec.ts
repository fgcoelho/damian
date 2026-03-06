import { describe, expect, it } from "vitest";
import {
  SLONIK_FRAGMENT,
  SLONIK_IDENTIFIER,
  SLONIK_QUERY,
} from "../src/utils.js";

describe("SLONIK_FRAGMENT", () => {
  it("is the well-known slonik fragment symbol", () => {
    expect(SLONIK_FRAGMENT).toBe(Symbol.for("SLONIK_TOKEN_FRAGMENT"));
  });
});

describe("SLONIK_QUERY", () => {
  it("is the well-known slonik query symbol", () => {
    expect(SLONIK_QUERY).toBe(Symbol.for("SLONIK_TOKEN_QUERY"));
  });
});

describe("SLONIK_IDENTIFIER", () => {
  it("is the well-known slonik identifier symbol", () => {
    expect(SLONIK_IDENTIFIER).toBe(Symbol.for("SLONIK_TOKEN_IDENTIFIER"));
  });
});
