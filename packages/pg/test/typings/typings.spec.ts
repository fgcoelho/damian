import { describe, expect, it } from "vitest";
import type { Typings } from "../../src/index";

describe("Typings", () => {
  it("allows custom typings with autocompletion", () => {
    type MyTypings = Typings<{
      public: {
        user: {
          id: any;
          name: any;
          role: any;
        };
        post: {
          id: any;
          title: any;
        };
      };
    }>;

    const customTypings = {
      public: {
        user: {
          role: {
            "~standard": {
              version: 1,
              vendor: "test",
              validate: (v: any) => ({ value: v as "admin" | "user" }),
            },
          },
        },
      },
    } satisfies MyTypings;

    expect(customTypings.public?.user?.role).toHaveProperty("~standard");
    expect((customTypings as any).public?.user?.id).toBeUndefined();
    expect((customTypings as any).public?.user?.name).toBeUndefined();
    expect((customTypings as any).public?.post).toBeUndefined();
  });

  it("allows empty object to satisfy Typings", () => {
    type MyTypings = Typings<{
      public: {
        user: {
          id: any;
          email: any;
        };
      };
    }>;

    const result = {} satisfies MyTypings;

    expect(result).toEqual({});
  });
});
