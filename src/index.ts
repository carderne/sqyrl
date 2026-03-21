import { checkFunctions, DEFAULT_DB, type DbType } from "./functions";
import { insertNeededGuardJoins } from "./graph";
import {
  applyGuards,
  resolveGuards,
  type OneOrTwoDots,
  type GuardVal,
  type SchemaGuardKeys,
  DEFAULT_LIMIT,
} from "./guard";
import { checkJoins, defineSchema, type Schema } from "./joins";
import { outputSql } from "./output";
import { parseSql } from "./parse";
import { Ok, returnOrThrow, type Result } from "./result";

export { parseSql, applyGuards as sanitiseSql, outputSql, defineSchema };
export type { DbType } from "./functions";

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
  {
    schema,
    autoJoin = true,
    limit = DEFAULT_LIMIT,
    pretty = false,
    db = DEFAULT_DB,
    allowExtraFunctions = [],
  }: {
    schema?: Schema;
    autoJoin?: boolean;
    limit?: number;
    pretty?: boolean;
    db?: DbType;
    allowExtraFunctions?: string[];
  } = {},
): string {
  const guards = { [column]: value };
  return privateAgentSql(sql, {
    guards,
    schema,
    autoJoin,
    limit,
    pretty,
    db,
    allowExtraFunctions,
    throws: true,
  });
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
  opts: {
    autoJoin?: boolean;
    limit?: number;
    pretty?: boolean;
    throws: false;
    db?: DbType;
    allowExtraFunctions?: string[];
  },
): (expr: string) => Result<string>;
export function createAgentSql<T extends Schema, S extends SchemaGuardKeys<T>>(
  schema: T,
  guards: Record<S, GuardVal>,
  opts?: {
    autoJoin?: boolean;
    limit?: number;
    pretty?: boolean;
    throws?: true;
    db?: DbType;
    allowExtraFunctions?: string[];
  },
): (expr: string) => string;
export function createAgentSql<T extends Schema, S extends SchemaGuardKeys<T>>(
  schema: T,
  guards: Record<S, GuardVal>,
  {
    autoJoin = true,
    limit = DEFAULT_LIMIT,
    pretty = false,
    db = DEFAULT_DB,
    allowExtraFunctions = [],
    throws = true,
  }: {
    autoJoin?: boolean;
    limit?: number;
    pretty?: boolean;
    throws?: boolean;
    db?: DbType;
    allowExtraFunctions?: string[];
  } = {},
): (expr: string) => Result<string> | string {
  return (expr: string) =>
    throws
      ? privateAgentSql(expr, {
          guards,
          schema,
          autoJoin,
          limit,
          pretty,
          db,
          allowExtraFunctions,
          throws,
        })
      : privateAgentSql(expr, {
          guards,
          schema,
          autoJoin,
          limit,
          pretty,
          db,
          allowExtraFunctions,
          throws,
        });
}

function privateAgentSql(
  sql: string,
  _: {
    guards: Record<string, GuardVal>;
    schema: Schema | undefined;
    autoJoin: boolean;
    limit: number;
    pretty: boolean;
    db: DbType;
    allowExtraFunctions: string[];
    throws: false;
  },
): Result<string>;
function privateAgentSql(
  sql: string,
  _: {
    guards: Record<string, GuardVal>;
    schema: Schema | undefined;
    autoJoin: boolean;
    limit: number;
    pretty: boolean;
    db: DbType;
    allowExtraFunctions: string[];
    throws: true;
  },
): string;
function privateAgentSql(
  sql: string,
  {
    guards: guardsRaw,
    schema,
    autoJoin,
    limit,
    pretty,
    db,
    allowExtraFunctions,
    throws,
  }: {
    guards: Record<string, GuardVal>;
    schema: Schema | undefined;
    autoJoin: boolean;
    limit: number;
    pretty: boolean;
    db: DbType;
    allowExtraFunctions: string[];
    throws: boolean;
  },
): Result<string> | string {
  const guards = resolveGuards(guardsRaw);
  if (!guards.ok) throw guards.error;
  const ast = parseSql(sql);
  if (!ast.ok) return returnOrThrow(ast, throws);
  const ast2 = checkJoins(ast.data, schema);
  if (!ast2.ok) return returnOrThrow(ast2, throws);
  const ast3 = checkFunctions(ast2.data, db, allowExtraFunctions);
  if (!ast3.ok) return returnOrThrow(ast3, throws);
  const ast4 = insertNeededGuardJoins(ast3.data, schema, guards.data, autoJoin);
  if (!ast4.ok) return returnOrThrow(ast4, throws);
  const san = applyGuards(ast4.data, guards.data, limit);
  if (!san.ok) return returnOrThrow(san, throws);
  const res = outputSql(san.data, pretty);
  if (throws) return res;
  return Ok(res);
}
