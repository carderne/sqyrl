import { AgentSqlError } from "./errors";
import type { GuardCol } from "./guard";
import { Ok, type Result } from "./result";

/*
 * Allows columns to be specified as either:
 * "table.column"
 * OR
 * "schema.table.column"
 */
export type OneOrTwoDots<S extends string> = S extends `${infer A}.${infer B}.${infer C}`
  ? A extends `${string}.${string}`
    ? never
    : B extends `${string}.${string}`
      ? never
      : C extends `${string}.${string}`
        ? never
        : S
  : S extends `${infer A}.${infer B}`
    ? A extends `${string}.${string}`
      ? never
      : B extends `${string}.${string}`
        ? never
        : S
    : never;

/*
 * We don't care about the fancy type here, that's only for the public
 * API
 */
export function getQualifiedColumnFromString(column: string): Result<GuardCol> {
  const [a, b, c] = column.split(".");
  if (a === undefined || b === undefined) {
    throw new AgentSqlError(`Malformed column string: '${column}'. Pass 'table.column'.`);
  }

  if (c === undefined) {
    // we have table.name (no schema)
    return Ok({
      table: a,
      column: b,
    });
  }

  // we have schema.table.name
  return Ok({
    schema: a,
    table: b,
    column: c,
  });
}
