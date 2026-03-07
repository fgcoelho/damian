import type { ValueExpression } from "slonik";

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
  if (Array.isArray(cell)) return serializeArray(cell);
  if (typeof cell === "object") return serializeObject(cell);

  return cell as ValueExpression;
}
