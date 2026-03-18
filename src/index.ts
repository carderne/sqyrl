import { outputSql } from "./output";
import { parseSql } from "./parse";
import { sanitiseSql } from "./sanitise";

export { parseSql, sanitiseSql, outputSql };

export function sqyrl(
  expr: string,
  {
    schema,
    table,
    column,
    value,
  }: {
    schema: string;
    table: string;
    column: string;
    value: string;
  },
): string {
  const ast = parseSql(expr);
  const san = sanitiseSql({ ast, schema, table, col: column, value });
  const res = outputSql(san);
  return res;
}
