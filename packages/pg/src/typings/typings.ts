export type CreateTypings<
  TShape extends Record<string, Record<string, Record<string, unknown>>>,
> = Partial<{
  [TSchema in keyof TShape]?: {
    [TTable in keyof TShape[TSchema]]?: {
      [TColumn in keyof TShape[TSchema][TTable]]?: unknown;
    };
  };
}>;
