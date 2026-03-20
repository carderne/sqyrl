import type {
  ASTNode,
  Alias,
  CaseExpr,
  CastExpr,
  Column,
  ColumnExpr,
  ColumnRef,
  Distinct,
  FuncCall,
  GroupByClause,
  HavingClause,
  JoinClause,
  JoinCondition,
  LimitClause,
  OffsetClause,
  OrderByClause,
  OrderByItem,
  SelectFrom,
  SelectStatement,
  TableRef,
  Terminal,
  WhereAnd,
  WhereArith,
  WhereBetween,
  WhereComparison,
  WhereIn,
  WhereIsBool,
  WhereIsNull,
  WhereLike,
  WhereNot,
  WhereOr,
  WhereRoot,
  WhereUnaryMinus,
  WhereValue,
} from "./ast";
import { unreachable } from "./utils";

export function outputSql(ast: SelectStatement): string {
  return normaliseWhitespace(r(ast));
}

function normaliseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function r(node: ASTNode | Terminal): string {
  if (node === null || node === undefined) {
    return "";
  }

  if (typeof node === "string") {
    return node;
  }

  if (typeof node === "number") {
    return String(node);
  }

  switch (node.type) {
    case "select":
      return handleSelect(node);
    case "select_from":
      return handleSelectFrom(node);
    case "join":
      return handleJoin(node);
    case "join_on":
    case "join_using":
      return handleJoinCondition(node);
    case "table_ref":
      return handleTableRef(node);
    case "limit":
      return handleLimit(node);
    case "offset":
      return handleOffset(node);
    case "order_by":
      return handleOrderBy(node);
    case "order_by_item":
      return handleOrderByItem(node);
    case "group_by":
      return handleGroupBy(node);
    case "having":
      return handleHaving(node);
    case "distinct":
      return handleDistinct(node);
    case "where_root":
      return handleWhereRoot(node);
    case "where_and":
      return handleWhereAnd(node);
    case "where_or":
      return handleWhereOr(node);
    case "where_not":
      return handleWhereNot(node);
    case "where_comparison":
      return handleWhereComparison(node);
    case "where_is_null":
      return handleWhereIsNull(node);
    case "where_is_bool":
      return handleWhereIsBool(node);
    case "where_between":
      return handleWhereBetween(node);
    case "where_in":
      return handleWhereIn(node);
    case "where_like":
      return handleWhereLike(node);
    case "where_arith":
      return handleWhereArith(node);
    case "where_unary_minus":
      return handleWhereUnaryMinus(node);
    case "case_expr":
      return handleCaseExpr(node);
    case "cast_expr":
      return handleCastExpr(node);
    case "where_value":
      return handleWhereValue(node as Extract<WhereValue, { type: "where_value" }>);
    case "column":
      return handleColumn(node);
    case "column_expr":
      return handleColumnExpr(node);
    case "column_ref":
      return handleColumnRef(node);
    case "alias":
      return handleAlias(node);
    case "func_call":
      return handleFuncCall(node);
    default:
      return unreachable(node);
  }
}

function mapR<T extends ASTNode>(t: T[]): string {
  return t.map((n) => r(n).trim()).join(", ");
}

function handleSelect(node: SelectStatement): string {
  const joins = node.joins.map((j) => r(j)).join(" ");
  const distinctStr = node.distinct ? `${r(node.distinct)} ` : "";
  return `SELECT ${distinctStr}${mapR(node.columns)} ${r(node.from)} ${joins} ${r(node.where)} ${r(node.groupBy)} ${r(node.having)} ${r(node.orderBy)} ${r(node.limit)} ${r(node.offset)}`;
}

function handleDistinct(_node: Distinct): string {
  return "DISTINCT";
}

function handleSelectFrom(node: SelectFrom): string {
  return `FROM ${r(node.table)}`;
}

function handleJoin(node: JoinClause): string {
  const typeStr: Record<string, string> = {
    inner: "INNER JOIN",
    inner_outer: "INNER OUTER JOIN",
    left: "LEFT JOIN",
    left_outer: "LEFT OUTER JOIN",
    right: "RIGHT JOIN",
    right_outer: "RIGHT OUTER JOIN",
    full: "FULL JOIN",
    full_outer: "FULL OUTER JOIN",
    cross: "CROSS JOIN",
    natural: "NATURAL JOIN",
  };
  const cond = node.condition ? ` ${handleJoinCondition(node.condition)}` : "";
  return `${typeStr[node.joinType]} ${r(node.table)}${cond}`;
}

function handleJoinCondition(node: JoinCondition): string {
  if (node.type === "join_on") {
    return `ON ${r(node.expr)}`;
  }
  return `USING (${node.columns.join(", ")})`;
}

function handleLimit(node: LimitClause): string {
  return `LIMIT ${node.value}`;
}

function handleOffset(node: OffsetClause): string {
  return `OFFSET ${node.value}`;
}

function handleGroupBy(node: GroupByClause): string {
  return `GROUP BY ${mapR(node.items)}`;
}

function handleHaving(node: HavingClause): string {
  return `HAVING ${r(node.expr)}`;
}

function handleOrderBy(node: OrderByClause): string {
  return `ORDER BY ${mapR(node.items)}`;
}

function handleOrderByItem(node: OrderByItem): string {
  const dir = node.direction ? ` ${node.direction.toUpperCase()}` : "";
  const nulls =
    node.nulls === "nulls_first"
      ? " NULLS FIRST"
      : node.nulls === "nulls_last"
        ? " NULLS LAST"
        : "";
  return `${r(node.expr)}${dir}${nulls}`;
}

export function handleTableRef(node: TableRef): string {
  const { schema, name } = node;
  const schemaPref = schema ? `"${schema}".` : "";
  return `${schemaPref}"${name}"`;
}

function handleWhereRoot(node: WhereRoot): string {
  return `WHERE ${r(node.inner)}`;
}

function handleWhereAnd(node: WhereAnd): string {
  return `(${r(node.left)} AND ${r(node.right)})`;
}

function handleWhereOr(node: WhereOr): string {
  return `(${r(node.left)} OR ${r(node.right)})`;
}

function handleWhereNot(node: WhereNot): string {
  return `NOT ${r(node.expr)}`;
}

function handleWhereIsNull(node: WhereIsNull): string {
  return `${r(node.expr)} IS${node.not ? " NOT" : ""} NULL`;
}

function handleWhereIsBool(node: WhereIsBool): string {
  const notStr = node.not ? " NOT" : "";
  const target = node.target === "unknown" ? "UNKNOWN" : node.target ? "TRUE" : "FALSE";
  return `${r(node.expr)} IS${notStr} ${target}`;
}

function handleWhereBetween(node: WhereBetween): string {
  return `${r(node.expr)}${node.not ? " NOT" : ""} BETWEEN ${r(node.low)} AND ${r(node.high)}`;
}

function handleWhereIn(node: WhereIn): string {
  return `${r(node.expr)}${node.not ? " NOT" : ""} IN (${mapR(node.list)})`;
}

function handleCaseExpr(node: CaseExpr): string {
  const subject = node.subject ? ` ${r(node.subject)}` : "";
  const whens = node.whens.map((w) => `WHEN ${r(w.condition)} THEN ${r(w.result)}`).join(" ");
  const elseStr = node.else ? ` ELSE ${r(node.else)}` : "";
  return `CASE${subject} ${whens}${elseStr} END`;
}

function handleCastExpr(node: CastExpr): string {
  return `CAST(${r(node.expr)} AS ${node.typeName})`;
}

function handleWhereArith(node: WhereArith): string {
  return `(${r(node.left)} ${node.op} ${r(node.right)})`;
}

function handleWhereUnaryMinus(node: WhereUnaryMinus): string {
  return `-${r(node.expr)}`;
}

function handleWhereLike(node: WhereLike): string {
  const notStr = node.not ? " NOT" : "";
  return `${r(node.expr)}${notStr} ${node.op.toUpperCase()} ${r(node.pattern)}`;
}

function handleWhereComparison(node: WhereComparison): string {
  return `${r(node.left)} ${node.operator} ${r(node.right)}`;
}

function handleWhereValue(node: Extract<WhereValue, { type: "where_value" }>): string {
  switch (node.kind) {
    case "string":
      return `'${node.value}'`;
    case "integer":
      return String(node.value);
    case "float":
      return String(node.value);
    case "bool":
      return node.value ? "TRUE" : "FALSE";
    case "null":
      return "NULL";
    case "column_ref":
      return r(node.ref);
    case "func_call":
      return r(node.func);
    default:
      return unreachable(node);
  }
}

function handleColumn(node: Column): string {
  return `${r(node.expr)} ${r(node.alias)}`;
}

function handleAlias(node: Alias): string {
  return `AS ${node.name}`;
}

function handleColumnRef(node: ColumnRef): string {
  const { schema, table, name } = node;
  const schemaPref = schema ? `"${schema}".` : "";
  const tablePref = table ? `"${table}".` : "";
  return `${schemaPref}${tablePref}"${name}"`;
}

function handleFuncCall(node: FuncCall): string {
  const { name, args } = node;
  if (args.kind === "wildcard") return `${name}(*)`;
  const distinctStr = args.distinct ? "DISTINCT " : "";
  return `${name}(${distinctStr}${mapR(args.args)})`;
}

function handleColumnExpr(node: ColumnExpr): string {
  switch (node.kind) {
    case "wildcard":
      return "*";
    case "qualified_wildcard":
      return `${node.table}.*`;
    case "expr":
      return r(node.expr!);
    default:
      return unreachable(node.kind);
  }
}
