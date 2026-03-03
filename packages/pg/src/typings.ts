import type { StandardSchemaV1 } from "@standard-schema/spec";

type DatabaseShape = Record<string, Record<string, Record<string, any>>>;

type LooseStandardSchema = StandardSchemaV1 & { [key: PropertyKey]: any };

type CustomTypings<TShape extends DatabaseShape> = {
  [TSchema in keyof TShape]?: {
    [TTable in keyof TShape[TSchema]]?: {
      [TColumn in keyof TShape[TSchema][TTable]]?: LooseStandardSchema;
    };
  };
};

export function typingsFactory<TShape extends DatabaseShape>() {
  return <const T extends CustomTypings<TShape>>(customTypings: T): T => {
    return customTypings;
  };
}
