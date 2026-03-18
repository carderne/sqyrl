import type {
  ASTNode,
  Alias,
  Column,
  ColumnExpr,
  ColumnRef,
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
  WhereComparison,
  WhereIsNull,
  WhereNot,
  WhereOr,
  WhereRoot,
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
    case "where_value":
      return handleWhereValue(node);
    case "column":
      return handleColumn(node);
    case "column_expr":
      return handleColumnExpr(node);
    case "column_ref":
      return handleColumnRef(node);
    case "alias":
      return handleAlias(node);
    default:
      return unreachable(node);
  }
}

function mapR<T extends ASTNode>(t: T[]): string {
  return t.map((n) => r(n).trim()).join(", ");
}

function handleSelect(node: SelectStatement): string {
  const joins = node.joins.map((j) => r(j)).join(" ");
  return `SELECT ${mapR(node.columns)} ${r(node.from)} ${joins} ${r(node.where)} ${r(node.groupBy)} ${r(node.having)} ${r(node.orderBy)} ${r(node.limit)} ${r(node.offset)}`;
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
  return `GROUP BY ${node.items.map((i) => r(i)).join(", ")}`;
}

function handleHaving(node: HavingClause): string {
  return `HAVING ${r(node.expr)}`;
}

function handleOrderBy(node: OrderByClause): string {
  return `ORDER BY ${node.items.map((i) => r(i)).join(", ")}`;
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

function handleTableRef(node: TableRef): string {
  const { schema, name, alias } = node;
  const schemaPref = schema ? `${schema}.` : "";
  return `${schemaPref}${name} ${r(alias)}`;
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
  return `${r(node.column)} IS${node.not ? " NOT" : ""} NULL`;
}

function handleWhereComparison(node: WhereComparison): string {
  return `${r(node.column)} ${node.operator} ${r(node.value)}`;
}

function handleWhereValue(node: WhereValue): string {
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
  const schemaPref = schema ? `${schema}.` : "";
  const tablePref = table ? `${table}.` : "";
  return `${schemaPref}${tablePref}${name}`;
}

function handleColumnExpr(node: ColumnExpr): string {
  switch (node.kind) {
    case "wildcard":
      return "*";
    case "qualified_wildcard":
      return `${node.table}.*`;
    case "qualified":
      return `${node.table}.${node.name}`;
    case "simple":
      return node.name!;
    default:
      return unreachable(node.kind);
  }
}
