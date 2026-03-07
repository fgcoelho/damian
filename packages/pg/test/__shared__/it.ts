/** biome-ignore-all lint/suspicious/noFocusedTests: ! */
import * as vi from "vitest";
import type { AnyType, Promisable } from "../../src/lib/utils";

export const it = () => {
  const shouldBuilder = (should: string) => ({
    test: (
      fn: (...params: AnyType[]) => Promisable<void>,
      opts?: Parameters<typeof vi.it>[1],
    ) => {
      return vi.it(`should ${should}`, opts, fn);
    },
    only: (
      fn: (...params: AnyType[]) => Promisable<void>,
      opts?: Parameters<typeof vi.it>[1],
    ) => {
      return vi.it.only(`should ${should}`, opts, fn);
    },
    skip: (
      fn: (...params: AnyType[]) => Promisable<void>,
      opts?: Parameters<typeof vi.it>[1],
    ) => {
      return vi.it.skip(`should ${should}`, opts, fn);
    },
  });

  return {
    should: (should: string) => shouldBuilder(should),
  };
};
