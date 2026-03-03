import type { ValueExpression } from "slonik";

function isLuxonLike(cell: object): cell is { toISO: () => string } {
  return typeof (cell as { toISO?: unknown }).toISO === "function";
}

function serializeArray(cell: unknown[]): ValueExpression {
  if (cell.length === 0) return "{}";
  if (String(cell[0]) === "[object Object]") return JSON.stringify(cell);
  return `{${cell.join(",")}}`;
}

function serializeObject(cell: object): ValueExpression {
  return JSON.stringify(cell);
}

export function serializeValue(cell: unknown): ValueExpression {
  if (cell === undefined || cell === null) return null;
  if (typeof cell === "object" && !Array.isArray(cell) && isLuxonLike(cell)) {
    return cell.toISO();
  }
  if (Array.isArray(cell)) return serializeArray(cell);
  if (typeof cell === "object") return serializeObject(cell);
  return cell as ValueExpression;
}
