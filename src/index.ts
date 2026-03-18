import { outputSql } from "./output";
import { parseSql } from "./parse";
import { sanitiseSql, type WhereGuard } from "./sanitise";

export { parseSql, sanitiseSql, outputSql };

export function sqyrl(expr: string, whereGuard: WhereGuard): string {
  const ast = parseSql(expr);
  const san = sanitiseSql(ast, whereGuard);
  const res = outputSql(san);
  return res;
}
