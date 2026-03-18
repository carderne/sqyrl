import type {
  ASTNode,
  Alias,
  Column,
  ColumnExpr,
  ColumnRef,
  LimitClause,
  SelectFrom,
  SelectStatement,
  TableName,
  TableRef,
  WhereComparison,
  WhereExpr,
  WhereRoot,
} from "./ast";
import grammar, { type SQLSemantics } from "./sql.ohm-bundle";

const semantics: SQLSemantics = grammar.createSemantics();

semantics.addOperation<ASTNode>("toAST()", {
  Statement(select, _semi) {
    return select.toAST();
  },

  SelectStatement(_select, columns, _from, tableRef, whereClause, limitClause) {
    const cols = columns.toAST() as Column[];
    const from: SelectFrom = {
      type: "select_from",
      table: tableRef.toAST() as TableRef,
    };
    const whereIter = whereClause.children;
    const where: WhereRoot | null =
      whereIter.length > 0
        ? { type: "where_root", inner: whereIter[0].toAST() as WhereExpr }
        : null;
    const limitIter = limitClause.children;
    const limit: LimitClause | null =
      limitIter.length > 0 ? { type: "limit", value: limitIter[0].toAST() as number } : null;

    return {
      type: "select",
      columns: cols,
      from,
      where,
      limit,
    } satisfies SelectStatement;
  },

  ColumnList(list) {
    return list.asIteration().children.map((c) => c.toAST()) as unknown as ASTNode;
  },

  ColumnEntry_aliased(expr, _as, alias) {
    return {
      type: "column",
      expr: expr.toAST() as ColumnExpr,
      alias: { type: "alias", name: alias.sourceString } satisfies Alias,
    } satisfies Column as ASTNode;
  },

  ColumnEntry_plain(expr) {
    return {
      type: "column",
      expr: expr.toAST() as ColumnExpr,
    } satisfies Column as ASTNode;
  },

  ColumnExpr_qualifiedWild(qw) {
    return qw.toAST();
  },

  ColumnExpr_wild(w) {
    return w.toAST();
  },

  ColumnExpr_qualified(qn) {
    return qn.toAST();
  },

  ColumnExpr_simple(ident) {
    return {
      type: "column_expr",
      kind: "simple",
      name: ident.sourceString,
    } satisfies ColumnExpr as ASTNode;
  },

  qualifiedWildcard(table, _dot, _star) {
    return {
      type: "column_expr",
      kind: "qualified_wildcard",
      table: table.sourceString,
    } satisfies ColumnExpr as ASTNode;
  },

  qualifiedName(table, _dot, col) {
    return {
      type: "column_expr",
      kind: "qualified",
      table: table.sourceString,
      name: col.sourceString,
    } satisfies ColumnExpr as ASTNode;
  },

  wildcard(_star) {
    return {
      type: "column_expr",
      kind: "wildcard",
    } satisfies ColumnExpr as ASTNode;
  },

  TableRef_aliased(tableName, _as, alias) {
    const tn = tableName.toAST() as TableName;
    return {
      type: "table_ref",
      ...tn,
      alias: { type: "alias", name: alias.sourceString } satisfies Alias,
    } satisfies TableRef as ASTNode;
  },

  TableRef_implicitAlias(tableName, alias) {
    const tn = tableName.toAST() as TableName;
    return {
      type: "table_ref",
      ...tn,
      alias: { type: "alias", name: alias.sourceString } satisfies Alias,
    } satisfies TableRef as ASTNode;
  },

  TableRef_plain(tableName) {
    const tn = tableName.toAST() as TableName;
    return {
      type: "table_ref",
      ...tn,
    } satisfies TableRef as ASTNode;
  },

  TableName_qualified(schema, _dot, name) {
    return {
      schema: schema.sourceString,
      name: name.sourceString,
    } satisfies TableName as ASTNode;
  },

  TableName_simple(name) {
    return {
      name: name.sourceString,
    } satisfies TableName as ASTNode;
  },

  WhereClause(_where, expr) {
    return expr.toAST();
  },

  WhereExpr(orExpr) {
    return orExpr.toAST();
  },

  WhereOrExpr_or(left, _or, right) {
    return {
      type: "where_or",
      left: left.toAST() as WhereExpr,
      right: right.toAST() as WhereExpr,
    } as ASTNode;
  },

  WhereAndExpr_and(left, _and, right) {
    return {
      type: "where_and",
      left: left.toAST() as WhereExpr,
      right: right.toAST() as WhereExpr,
    } as ASTNode;
  },

  WherePrimary_paren(_open, expr, _close) {
    return expr.toAST();
  },

  WhereComparison(colRef, _eq, value) {
    return {
      type: "where_comparison",
      operator: "=",
      column: colRef.toAST() as ColumnRef,
      value: value.toAST() as string,
    } satisfies WhereComparison as ASTNode;
  },

  ColumnRef_qualified(table, _dot, name) {
    return {
      type: "column_ref",
      table: table.sourceString,
      name: name.sourceString,
    } satisfies ColumnRef as ASTNode;
  },

  ColumnRef_simple(name) {
    return {
      type: "column_ref",
      name: name.sourceString,
    } satisfies ColumnRef as ASTNode;
  },

  stringLiteral(_open, chars, _close) {
    return chars.sourceString as unknown as ASTNode;
  },

  LimitClause(_limit, integer) {
    return integer.toAST();
  },

  integer(_digits) {
    return parseInt(this.sourceString, 10) as unknown as ASTNode;
  },
});

export function parseSql(expr: string): SelectStatement {
  const matchResult = grammar.match(expr);
  if (matchResult.failed()) {
    throw new Error(matchResult.message);
  }
  return semantics(matchResult).toAST() as SelectStatement;
}
