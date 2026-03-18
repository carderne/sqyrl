import type {
  ASTNode,
  Alias,
  Column,
  ColumnExpr,
  ColumnRef,
  LimitClause,
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
    case "table_ref":
      return handleTableRef(node);
    case "limit":
      return handleLimit(node);
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
  return `SELECT ${mapR(node.columns)} ${r(node.from)} ${r(node.where)} ${r(node.limit)}`;
}

function handleSelectFrom(node: SelectFrom): string {
  return `FROM ${r(node.table)}`;
}

function handleLimit(node: LimitClause): string {
  return `LIMIT ${node.value}`;
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
