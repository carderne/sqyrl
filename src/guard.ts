import type {
  ColumnRef,
  LimitClause,
  SelectStatement,
  TableRef,
  WhereComparison,
  WhereValue,
} from "./ast";
import { SanitiseError } from "./errors";
import { handleTableRef } from "./output";
import { Err, Ok, type Result } from "./result";

export type GuardVal = string | number;

export interface GuardCol {
  schema?: string;
  table: string;
  column: string;
}

export type WhereGuard = GuardCol & {
  value: GuardVal;
};

export const DEFAULT_LIMIT = 10000;

export function addGuards(
  ast: SelectStatement,
  guard: WhereGuard,
  limit: number = DEFAULT_LIMIT,
): Result<SelectStatement> {
  const ast2 = addWhereGuard(ast, guard);
  if (!ast2.ok) return ast2;
  return addLimitGuard(ast2.data, limit);
}

/*
 * Sanitises the supplied Select statement by adding a WHERE clause e.g.
 * WHERE schema.table.col = 'value'
 */
function addWhereGuard(ast: SelectStatement, guard: WhereGuard): Result<SelectStatement> {
  const { schema, table, column, value } = guard;
  // First check that the FROM or JOIN clauses include the required table
  const tableRef: TableRef = { type: "table_ref", schema, name: table };
  const hasNeededTable = checkIfTableRefExists(ast, tableRef);
  if (!hasNeededTable) {
    const tableName = handleTableRef(tableRef);
    return Err(
      new SanitiseError(`The table '${tableName}' must appear in the FROM or JOIN clauses.`),
    );
  }

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

  return Ok({
    ...ast,
    where: ast.where
      ? {
          type: "where_root",
          inner: { type: "where_and", left: newClause, right: ast.where.inner },
        }
      : { type: "where_root", inner: newClause },
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
