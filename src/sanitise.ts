import type { SelectStatement, WhereComparison } from "./ast";

/*
 * Sanitises the supplied Select statement by adding a WHERE clause e.g.
 * WHERE schema.table.col = 'value'
 */
export function sanitiseSql({
  ast,
  schema,
  table,
  col,
  value,
}: {
  ast: SelectStatement;
  schema: string;
  table: string;
  col: string;
  value: string;
}): SelectStatement {
  const newClause: WhereComparison = {
    type: "where_comparison",
    operator: "=",
    left: {
      type: "where_value",
      kind: "column_ref",
      ref: {
        type: "column_ref",
        table: `${schema}.${table}`,
        name: col,
      },
    },
    right: { type: "where_value", kind: "string", value },
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
