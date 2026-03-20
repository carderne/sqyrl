import { addGuards, type GuardVal } from "./guard";
import { checkJoins, defineSchema, type Schema } from "./joins";
import { getQualifiedColumnFromString, type OneOrTwoDots } from "./namespec";
import { outputSql } from "./output";
import { parseSql } from "./parse";
import { Ok, returnOrThrow, type Result } from "./result";

export { parseSql, addGuards as sanitiseSql, outputSql, defineSchema };

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
  return privateAgentSql(sql, { column, value, schema, limit, throws: true });
}

/*
 * A factory function with a pile of overloads
 *
 * If `value` is provided it returns a function, otherwise a factory
 *
 * With value:
 * ```ts
 * const agentSql = createAgentSql({ ..., value: 123 });
 * const sql = agentSql("SELECT * ...");
 * ```
 *
 * Without value:
 * ```ts
 * const agentSqlFactory = createAgentSql({ ..., value: undefined})
 * const agentSql = agentSqlFactory(123);
 * const sql = agentSql("SELECT * ...");
 * ```
 *
 * If `throws: true` is passed (the default), it will throw on errors.
 * Otherwise it will return a Result type with an `ok` field as discriminator.
 */
export function createAgentSql<S extends string>(_: {
  column: S & OneOrTwoDots<S>;
  value: GuardVal;
  schema?: Schema;
  limit?: number;
  throws: false;
}): (expr: string) => Result<string>;
export function createAgentSql<S extends string>(_: {
  column: S & OneOrTwoDots<S>;
  value: GuardVal;
  schema?: Schema;
  limit?: number;
  throws?: true;
}): (expr: string) => string;
export function createAgentSql<S extends string>(_: {
  column: S & OneOrTwoDots<S>;
  value?: undefined;
  schema?: Schema;
  limit?: number;
  throws: false;
}): (guardVal: GuardVal) => (expr: string) => Result<string>;
export function createAgentSql<S extends string>(_: {
  column: S & OneOrTwoDots<S>;
  value?: undefined;
  schema?: Schema;
  limit?: number;
  throws?: true;
}): (guardVal: GuardVal) => (expr: string) => string;
export function createAgentSql<S extends string>({
  column,
  schema,
  value,
  limit,
  throws = true,
}: {
  column: S & OneOrTwoDots<S>;
  value?: GuardVal;
  schema?: Schema;
  limit?: number;
  throws?: boolean;
}):
  | ((expr: string) => Result<string> | string)
  | ((guardVal: GuardVal) => (expr: string) => Result<string> | string) {
  if (value !== undefined) {
    return (expr: string) =>
      throws
        ? privateAgentSql(expr, { column, value, schema, limit, throws })
        : privateAgentSql(expr, { column, value, schema, limit, throws });
  }

  function factory(guardVal: GuardVal) {
    // TypeScript can't figure out the OneOrTwoDots -> OneOrTwoDots generic stuff
    return throws
      ? createAgentSql({ column: column as any, schema, value: guardVal, limit, throws })
      : createAgentSql({ column: column as any, schema, value: guardVal, limit, throws });
  }
  return factory;
}

function privateAgentSql(
  sql: string,
  _: { column: string; value: GuardVal; schema?: Schema; limit?: number; throws: false },
): Result<string>;
function privateAgentSql(
  sql: string,
  _: { column: string; value: GuardVal; schema?: Schema; limit?: number; throws: true },
): string;
function privateAgentSql(
  sql: string,
  {
    column,
    value,
    schema,
    limit,
    throws,
  }: {
    column: string;
    value: GuardVal;
    schema?: Schema;
    limit?: number;
    throws: boolean;
  },
): Result<string> | string {
  const guardCol = getQualifiedColumnFromString(column);
  if (!guardCol.ok) throw guardCol.error;
  const ast = parseSql(sql);
  if (!ast.ok) return returnOrThrow(ast, throws);
  const ast2 = checkJoins(ast.data, schema);
  if (!ast2.ok) return returnOrThrow(ast2, throws);
  const where = { ...guardCol.data, value };
  const san = addGuards(ast2.data, where, limit);
  if (!san.ok) return returnOrThrow(san, throws);
  const res = outputSql(san.data);
  if (throws) return res;
  return Ok(res);
}
