import type {
  ColumnRef,
  LimitClause,
  SelectStatement,
  TableRef,
  WhereComparison,
  WhereExpr,
  WhereValue,
} from "./ast";
import { AgentSqlError, SanitiseError } from "./errors";
import { handleTableRef } from "./output";
import { Err, Ok, type Result } from "./result";

export const DEFAULT_LIMIT = 10000;

export type GuardVal = string | number;

export interface GuardCol {
  schema?: string;
  table: string;
  column: string;
}

export type WhereGuard = GuardCol & {
  value: GuardVal;
};

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
 * Given a schema object (from `defineSchema`), produces a union of all valid
 * "table.column" strings, e.g. `"orders.tenant_id" | "orders.id" | …`
 */
export type SchemaGuardKeys<T> = {
  [Table in keyof T & string]: `${Table}.${keyof T[Table] & string}`;
}[keyof T & string];

export function applyGuards(
  ast: SelectStatement,
  guards: WhereGuard[],
  limit: number = DEFAULT_LIMIT,
): Result<SelectStatement> {
  const ast2 = addWhereGuard(ast, guards);
  if (!ast2.ok) return ast2;
  return addLimitGuard(ast2.data, limit);
}
/*
 * We don't care about the fancy type here, that's only for the public
 * API
 */
export function resolveGuards(guards: Record<string, GuardVal>): Result<WhereGuard[]> {
  if (guards.length === 0) {
    return Err(new AgentSqlError("At least one guard must be provided."));
  }
  const result: WhereGuard[] = [];

  for (const [column, value] of Object.entries(guards)) {
    const guardCol = resolveSingleGuardCol(column);
    if (!guardCol.ok) return guardCol;
    result.push({ ...guardCol.data, value });
  }
  return Ok(result);
}

function resolveSingleGuardCol(column: string): Result<GuardCol> {
  const [a, b, c] = column.split(".");
  if (a === undefined || b === undefined) {
    return Err(new AgentSqlError(`Malformed column string: '${column}'. Pass 'table.column'.`));
  }

  if (c === undefined) {
    // we have table.name (no schema)
    return Ok({
      table: a,
      column: b,
    });
  }
  return Err(new AgentSqlError("Specifying guard as schema.table.name not yet supported"));

  // TODO support and fix SchemaGuardKeys at the same time
  // // we have schema.table.name
  // return Ok({
  //   schema: a,
  //   table: b,
  //   column: c,
  // });
}

/*
 * Sanitises the supplied Select statement by adding a WHERE clause e.g.
 * WHERE schema.table.col = 'value'
 */
function addWhereGuard(ast: SelectStatement, guards: WhereGuard[]): Result<SelectStatement> {
  // First check that the FROM or JOIN clauses include the required tables
  for (const guard of guards) {
    const tableRef: TableRef = { type: "table_ref", schema: guard.schema, name: guard.table };
    const hasNeededTable = checkIfTableRefExists(ast, tableRef);
    if (!hasNeededTable) {
      const tableName = handleTableRef(tableRef);
      return Err(
        new SanitiseError(`The table '${tableName}' must appear in the FROM or JOIN clauses.`),
      );
    }
  }

  const newClauses = guards.map((guard) => {
    const { schema, table, column, value } = guard;
    const whereRightClause: WhereValue =
      typeof value === "string"
        ? { type: "where_value", kind: "string", value }
        : { type: "where_value", kind: "integer", value };

    const newClause: WhereComparison = {
      type: "where_comparison",
      operator: "=",
      left: {
        type: "where_value",
        kind: "column_ref",
        ref: {
          type: "column_ref",
          schema,
          table,
          name: column,
        } satisfies ColumnRef,
      } satisfies WhereValue,
      right: whereRightClause,
    };
    return newClause;
  });

  // AND all guard clauses together into a single WhereExpr
  const [first, ...rest] = newClauses;
  if (!first) {
    return Err(new AgentSqlError("No guards were provided"));
  }
  const combined: WhereExpr = rest.reduce<WhereExpr>(
    (acc, clause) => ({ type: "where_and", left: acc, right: clause }),
    first,
  );

  return Ok({
    ...ast,
    where: ast.where
      ? {
          type: "where_root",
          inner: { type: "where_and", left: combined, right: ast.where.inner },
        }
      : { type: "where_root", inner: combined },
  });
}

/*
 * Enforce a LIMIT clause if no limit or the SQL limit is higher
 * than the enforced one
 */
function addLimitGuard(ast: SelectStatement, limit: number): Result<SelectStatement> {
  const limitClause: LimitClause = { type: "limit", value: limit };
  if (ast.limit === null) {
    return Ok({ ...ast, limit: limitClause });
  }

  if (ast.limit.value > limit) {
    return Ok({ ...ast, limit: limitClause });
  }

  return Ok(ast);
}

function checkIfTableRefExists(ast: SelectStatement, tableRef: TableRef): boolean {
  return (
    tableEquals(ast.from.table, tableRef) ||
    ast.joins.some((join) => tableEquals(join.table, tableRef))
  );
}

function tableEquals(a: TableRef, b: TableRef): boolean {
  return a.schema == b.schema && a.name == b.name;
}
