import type {
  ASTNode,
  Alias,
  Column,
  ColumnExpr,
  ColumnRef,
  ComparisonOperator,
  JoinClause,
  JoinCondition,
  JoinType,
  LimitClause,
  SelectFrom,
  SelectStatement,
  TableName,
  TableRef,
  WhereComparison,
  WhereExpr,
  WhereIsNull,
  WhereNot,
  WhereRoot,
  WhereValue,
} from "./ast";
import grammar, { type SQLSemantics } from "./sql.ohm-bundle";

const semantics: SQLSemantics = grammar.createSemantics();

semantics.addOperation<ASTNode>("toAST()", {
  Statement(select, _semi) {
    return select.toAST();
  },

  SelectStatement(_select, columns, _from, tableRef, joinClauses, whereClause, limitClause) {
    const cols = columns.toAST() as Column[];
    const from: SelectFrom = {
      type: "select_from",
      table: tableRef.toAST() as TableRef,
    };
    const joins = joinClauses.children.map((j) => j.toAST() as JoinClause);
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
      joins,
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

  JoinClause_typed(joinTypeNode, _join, tableRef, condition) {
    return {
      type: "join",
      joinType: joinTypeNode.toAST() as JoinType,
      table: tableRef.toAST() as TableRef,
      condition: condition.toAST() as JoinCondition,
    } satisfies JoinClause as ASTNode;
  },

  JoinClause_cross(_cross, _join, tableRef) {
    return {
      type: "join",
      joinType: "cross",
      table: tableRef.toAST() as TableRef,
      condition: null,
    } satisfies JoinClause as ASTNode;
  },

  JoinClause_natural(_natural, _join, tableRef) {
    return {
      type: "join",
      joinType: "natural",
      table: tableRef.toAST() as TableRef,
      condition: null,
    } satisfies JoinClause as ASTNode;
  },

  JoinType_innerOuter(_inner, _outer) {
    return "inner_outer" as unknown as ASTNode;
  },

  JoinType_inner(_inner) {
    return "inner" as unknown as ASTNode;
  },

  JoinType_leftOuter(_left, _outer) {
    return "left_outer" as unknown as ASTNode;
  },

  JoinType_left(_left) {
    return "left" as unknown as ASTNode;
  },

  JoinType_rightOuter(_right, _outer) {
    return "right_outer" as unknown as ASTNode;
  },

  JoinType_right(_right) {
    return "right" as unknown as ASTNode;
  },

  JoinType_fullOuter(_full, _outer) {
    return "full_outer" as unknown as ASTNode;
  },

  JoinType_full(_full) {
    return "full" as unknown as ASTNode;
  },

  JoinCondition_on(_on, expr) {
    return {
      type: "join_on",
      expr: expr.toAST() as WhereExpr,
    } satisfies JoinCondition as ASTNode;
  },

  JoinCondition_using(_using, _open, cols, _close) {
    return {
      type: "join_using",
      columns: cols.asIteration().children.map((c) => c.sourceString) as string[],
    } satisfies JoinCondition as ASTNode;
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

  WherePrimary_not(_not, expr) {
    return {
      type: "where_not",
      expr: expr.toAST() as WhereExpr,
    } satisfies WhereNot as ASTNode;
  },

  WhereComparison_compare(colRef, op, value) {
    return {
      type: "where_comparison",
      operator: op.sourceString as ComparisonOperator,
      column: colRef.toAST() as ColumnRef,
      value: value.toAST() as WhereValue,
    } satisfies WhereComparison as ASTNode;
  },

  WhereComparison_isNotNull(colRef, _is, _not, _null) {
    return {
      type: "where_is_null",
      not: true,
      column: colRef.toAST() as ColumnRef,
    } satisfies WhereIsNull as ASTNode;
  },

  WhereComparison_isNull(colRef, _is, _null) {
    return {
      type: "where_is_null",
      not: false,
      column: colRef.toAST() as ColumnRef,
    } satisfies WhereIsNull as ASTNode;
  },

  WhereValue_string(s) {
    return {
      type: "where_value",
      kind: "string",
      value: s.toAST() as string,
    } satisfies WhereValue as ASTNode;
  },

  WhereValue_integer(n) {
    return {
      type: "where_value",
      kind: "integer",
      value: n.toAST() as number,
    } satisfies WhereValue as ASTNode;
  },

  WhereValue_float(f) {
    return {
      type: "where_value",
      kind: "float",
      value: parseFloat(f.sourceString),
    } satisfies WhereValue as ASTNode;
  },

  WhereValue_bool(b) {
    return {
      type: "where_value",
      kind: "bool",
      value: b.sourceString.toLowerCase() === "true",
    } satisfies WhereValue as ASTNode;
  },

  WhereValue_null(_null) {
    return {
      type: "where_value",
      kind: "null",
    } satisfies WhereValue as ASTNode;
  },

  WhereValue_columnRef(colRef) {
    return {
      type: "where_value",
      kind: "column_ref",
      ref: colRef.toAST() as ColumnRef,
    } satisfies WhereValue as ASTNode;
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

  floatLiteral(_int, _dot, _frac) {
    return parseFloat(this.sourceString) as unknown as ASTNode;
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
