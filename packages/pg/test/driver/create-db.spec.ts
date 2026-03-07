import { describe, expect } from "vitest";
import { createTypeParserPreset } from "../../src/index";
import { createTestPool } from "../__shared__/database";
import { it } from "../__shared__/it";

describe("createDb", () => {
  it()
    .should("export createTypeParserPreset")
    .test(() => {
      expect(createTypeParserPreset).toBeDefined();
      expect(typeof createTypeParserPreset).toBe("function");
    });

  it()
    .should("return a DatabasePool with query/transaction/end methods")
    .test(async () => {
      const db = await createTestPool();

      expect(typeof db.query).toBe("function");
      expect(typeof db.transaction).toBe("function");
      expect(typeof db.end).toBe("function");

      await db.end();
    });
});
