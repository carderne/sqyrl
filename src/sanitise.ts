import type { ColumnRef, SelectStatement, TableRef, WhereComparison, WhereValue } from "./ast";
import { handleTableRef } from "./output";

export interface WhereGuard {
  schema?: string;
  table: string;
  col: string;
  value: string | number;
}

/*
 * Sanitises the supplied Select statement by adding a WHERE clause e.g.
 * WHERE schema.table.col = 'value'
 */
export function sanitiseSql(
  ast: SelectStatement,
  { schema, table, col, value }: WhereGuard,
): SelectStatement {
  // First check that the FROM or JOIN clauses include the required table
  const tableRef: TableRef = { type: "table_ref", schema, name: table };
  const hasNeededTable = checkIfTableRefExists(ast, tableRef);
  if (!hasNeededTable) {
    const tableName = handleTableRef(tableRef);
    throw new Error(`The table '${tableName}' must appear in the FROM or JOIN clauses.`);
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
        name: col,
      } satisfies ColumnRef,
    } satisfies WhereValue,
    right: whereRightClause,
  };

  return {
    ...ast,
    where: ast.where
      ? {
          type: "where_root",
          inner: { type: "where_and", left: newClause, right: ast.where.inner },
        }
      : { type: "where_root", inner: newClause },
  };
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
