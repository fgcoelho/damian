import fs from "node:fs";

function findMatchingBrace(content: string, start: number): number {
  let depth = 1;
  for (let i = start; i < content.length; i++) {
    if (content[i] === "{") depth++;
    if (content[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseObject(
  content: string,
  path: string[],
  typings: Record<string, string>,
): void {
  const trimmed = content.trim();
  if (!trimmed) return;

  let i = 0;
  while (i < trimmed.length) {
    if (!/\w/.test(trimmed[i])) {
      i++;
      continue;
    }

    const keyStart = i;
    while (i < trimmed.length && /[\w_]/.test(trimmed[i])) i++;
    const key = trimmed.substring(keyStart, i);

    while (i < trimmed.length && /\s/.test(trimmed[i])) i++;

    if (i >= trimmed.length || trimmed[i] !== ":") {
      i++;
      continue;
    }
    i++;

    while (i < trimmed.length && /\s/.test(trimmed[i])) i++;

    if (i < trimmed.length && trimmed[i] === "{") {
      const braceStart = i + 1;
      const braceEnd = findMatchingBrace(trimmed, braceStart);
      if (braceEnd === -1) break;

      parseObject(
        trimmed.substring(braceStart, braceEnd),
        [...path, key],
        typings,
      );
      i = braceEnd + 1;
    } else {
      const valueStart = i;
      let depth = 0;
      while (
        i < trimmed.length &&
        (trimmed[i] !== "," || depth > 0) &&
        (trimmed[i] !== "}" || depth > 0)
      ) {
        if (trimmed[i] === "(" || trimmed[i] === "[" || trimmed[i] === "{")
          depth++;
        if (trimmed[i] === ")" || trimmed[i] === "]" || trimmed[i] === "}")
          depth--;
        i++;
      }

      const value = trimmed.substring(valueStart, i).trim();
      if (value && path.length > 0) {
        typings[[...path, key].join(".")] = "custom";
      }

      if (i < trimmed.length && trimmed[i] === ",") i++;
    }
  }
}

function parseNewFormat(typingsSrc: string): Record<string, string> | null {
  const callMatch = typingsSrc.match(/export\s+default\s+typings\s*\(\s*\{/);
  if (!callMatch || callMatch.index === undefined) return null;

  const braceStart = (callMatch.index ?? 0) + callMatch[0].length;
  const braceEnd = findMatchingBrace(typingsSrc, braceStart);
  if (braceEnd === -1) return null;

  const typings: Record<string, string> = {};
  parseObject(typingsSrc.substring(braceStart, braceEnd), [], typings);
  return typings;
}

function parseOldFormat(typingsSrc: string): Record<string, string> | null {
  const match = typingsSrc.match(/export\s+default\s+({[\s\S]+});?/);
  if (!match) return null;

  const typings: Record<string, string> = {};
  const entries = [...match[1].matchAll(/["']([\w.]+)["']\s*:\s*([^,}]+)/g)];
  for (const e of entries) {
    typings[e[1]] = e[2].trim();
  }
  return typings;
}

export function readTypings(typingsFile: string): Record<string, string> {
  if (!fs.existsSync(typingsFile)) return {};

  const typingsSrc = fs.readFileSync(typingsFile, "utf8");
  return parseNewFormat(typingsSrc) ?? parseOldFormat(typingsSrc) ?? {};
}
