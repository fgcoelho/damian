import { describe, expect, it } from "vitest";
import type { CreateTypings } from "../../src";

type Typings = CreateTypings<{
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

describe("Typings", () => {
  it("allows custom typings with autocompletion", () => {
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
    } satisfies Typings;

    expect(customTypings.public?.user?.role).toHaveProperty("~standard");
    expect((customTypings as any).public?.user?.id).toBeUndefined();
    expect((customTypings as any).public?.user?.name).toBeUndefined();
    expect((customTypings as any).public?.post).toBeUndefined();
  });
});
