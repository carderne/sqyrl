import {
  applyGuards,
  resolveGuards,
  type OneOrTwoDots,
  type GuardVal,
  type SchemaGuardKeys,
} from "./guard";
import { checkJoins, defineSchema, type Schema } from "./joins";
import { outputSql } from "./output";
import { parseSql } from "./parse";
import { Ok, returnOrThrow, type Result } from "./result";

export { parseSql, applyGuards as sanitiseSql, outputSql, defineSchema };

/*
 * A simple "README-friendly" API that doesn't require a schema to be provided
 * If the schema is not provided, JOINs will be rejected
 * (as they cannot be validated to be safe)
 *
 * This function always throws on errors
 */
export function agentSql<S extends string>(
  sql: string,
  column: S & OneOrTwoDots<S>,
  value: GuardVal,
  { schema, limit }: { schema?: Schema; limit?: number } = {},
): string {
  const guards = { [column]: value };
  return privateAgentSql(sql, { guards, schema, limit, throws: true });
}

/*
 * Factory function for agentSql re-use
 *
 * ```ts
 * const schema = defineSchema({ orders: { tenant_id: null } });
 * const agentSql = createAgentSql(schema, { "orders.tenant_id": "t42" });
 * const sql = agentSql("SELECT * ...");
 * ```
 *
 * Guard keys are type-checked against the schema: only `"table.column"`
 * combinations that actually exist in the schema are accepted.
 *
 * If `throws: true` is passed (the default), it will throw on errors.
 * Otherwise it will return a Result type with an `ok` field as discriminator.
 */
export function createAgentSql<T extends Schema, S extends SchemaGuardKeys<T>>(
  schema: T,
  guards: Record<S, GuardVal>,
  opts: { limit?: number; throws: false },
): (expr: string) => Result<string>;
export function createAgentSql<T extends Schema, S extends SchemaGuardKeys<T>>(
  schema: T,
  guards: Record<S, GuardVal>,
  opts?: { limit?: number; throws?: true },
): (expr: string) => string;
export function createAgentSql<T extends Schema, S extends SchemaGuardKeys<T>>(
  schema: T,
  guards: Record<S, GuardVal>,
  { limit, throws = true }: { limit?: number; throws?: boolean } = {},
): (expr: string) => Result<string> | string {
  return (expr: string) =>
    throws
      ? privateAgentSql(expr, { guards, schema, limit, throws })
      : privateAgentSql(expr, { guards, schema, limit, throws });
}

function privateAgentSql(
  sql: string,
  _: { guards: Record<string, GuardVal>; schema?: Schema; limit?: number; throws: false },
): Result<string>;
function privateAgentSql(
  sql: string,
  _: { guards: Record<string, GuardVal>; schema?: Schema; limit?: number; throws: true },
): string;
function privateAgentSql(
  sql: string,
  {
    guards: guardsRaw,
    schema,
    limit,
    throws,
  }: {
    guards: Record<string, GuardVal>;
    schema?: Schema;
    limit?: number;
    throws: boolean;
  },
): Result<string> | string {
  const guards = resolveGuards(guardsRaw);
  if (!guards.ok) throw guards.error;
  const ast = parseSql(sql);
  if (!ast.ok) return returnOrThrow(ast, throws);
  const ast2 = checkJoins(ast.data, schema);
  if (!ast2.ok) return returnOrThrow(ast2, throws);
  const san = applyGuards(ast2.data, guards.data, limit);
  if (!san.ok) return returnOrThrow(san, throws);
  const res = outputSql(san.data);
  if (throws) return res;
  return Ok(res);
}
