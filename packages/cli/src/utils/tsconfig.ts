import fs from "node:fs";
import path from "node:path";

export function getTsconfigAliases(cwd: string): Record<string, string> {
  const tsconfigPath = path.resolve(cwd, "tsconfig.json");

  if (!fs.existsSync(tsconfigPath)) return {};

  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
  } catch {
    return {};
  }

  const paths = ((
    json as { compilerOptions?: { paths?: Record<string, string[]> } }
  ).compilerOptions?.paths ?? {}) as Record<string, string[]>;

  const basePath = path.dirname(tsconfigPath);
  const aliases: Record<string, string> = {};

  for (const [alias, values] of Object.entries(paths)) {
    if (!values[0]) continue;
    aliases[alias.replace(/\/\*$/, "")] = path.resolve(
      basePath,
      values[0].replace(/\/\*$/, ""),
    );
  }

  return aliases;
}
