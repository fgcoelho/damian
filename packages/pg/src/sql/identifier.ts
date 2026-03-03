import { createSqlTag } from "slonik";
import type { AnyType } from "../utils.js";

const sqlTag = createSqlTag({ typeAliases: { void: (() => {}) as AnyType } });

/**
 * Thin wrapper for sql.identifier that can be imported without circular deps.
 */
export const { identifier, fragment } = sqlTag;
