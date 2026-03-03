import fs from "node:fs";
import * as prettier from "prettier";

async function formatFile(filePath: string): Promise<void> {
  const source = fs.readFileSync(filePath, "utf8");
  const formatted = await prettier.format(source, { filepath: filePath });
  fs.writeFileSync(filePath, formatted, "utf8");
}

export async function formatFiles(files: string[]): Promise<void> {
  await Promise.all(files.map(formatFile));
}
