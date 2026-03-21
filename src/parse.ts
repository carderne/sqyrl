import type {
  ASTNode,
  Alias,
  ArithOp,
  CaseExpr,
  CaseWhen,
  CastExpr,
  Column,
  ColumnExpr,
  ColumnRef,
  ComparisonOperator,
  Distinct,
  DistinctOn,
  FuncCall,
  FuncCallArg,
  GroupByClause,
  HavingClause,
  IsBoolTarget,
  JsonbOp,
  PgvectorOp,
  JoinClause,
  JoinCondition,
  JoinType,
  LimitClause,
  LikeOp,
  NullsOrder,
  OffsetClause,
  OrderByClause,
  OrderByItem,
  SelectFrom,
  SelectStatement,
  SortDirection,
  TableName,
  TableRef,
  WhereBetween,
  WhereArith,
  WhereComparison,
  WhereExpr,
  WhereIn,
  WhereIsBool,
  WhereIsNull,
  WhereJsonbOp,
  WherePgvectorOp,
  WhereLike,
  WhereNot,
  WhereRoot,
  WhereTsMatch,
  WhereUnaryMinus,
  WhereValue,
} from "./ast";
import { ParseError, SanitiseError } from "./errors";
import { Err, Ok, type Result } from "./result";
import grammar, { type SQLSemantics } from "./sql.ohm-bundle";

const semantics: SQLSemantics = grammar.createSemantics();

semantics.addOperation<ASTNode>("toAST()", {
  Statement(select, _semi) {
    return select.toAST();
  },

  SelectStatement(
    _select,
    distinctOpt,
    columns,
    _from,
    tableRef,
    joinClauses,
    whereClause,
    groupByClause,
    havingClause,
    orderByClause,
    limitClause,
    offsetClause,
  ) {
    const distinct: Distinct | DistinctOn | null =
      distinctOpt.children.length > 0
        ? (distinctOpt.children[0]!.toAST() as Distinct | DistinctOn)
        : null;
    const cols = columns.toAST() as Column[];
    const from: SelectFrom = {
      type: "select_from",
      table: tableRef.toAST() as TableRef,
    };
    const joins = joinClauses.children.map((j) => j.toAST() as JoinClause);
    const whereIter = whereClause.children;
    const where: WhereRoot | null =
      whereIter.length > 0
        ? { type: "where_root", inner: whereIter[0]!.toAST() as WhereExpr }
        : null;
    const groupBy: GroupByClause | null =
      groupByClause.children.length > 0
        ? (groupByClause.children[0]!.toAST() as GroupByClause)
        : null;
    const having: HavingClause | null =
      havingClause.children.length > 0 ? (havingClause.children[0]!.toAST() as HavingClause) : null;
    const orderBy: OrderByClause | null =
      orderByClause.children.length > 0
        ? (orderByClause.children[0]!.toAST() as OrderByClause)
        : null;
    const limitIter = limitClause.children;
    const limit: LimitClause | null =
      limitIter.length > 0 ? { type: "limit", value: limitIter[0]!.toAST() as number } : null;
    const offsetIter = offsetClause.children;
    const offset: OffsetClause | null =
      offsetIter.length > 0 ? { type: "offset", value: offsetIter[0]!.toAST() as number } : null;

    return {
      type: "select",
      distinct,
      columns: cols,
      from,
      joins,
      where,
      groupBy,
      having,
      orderBy,
      limit,
      offset,
    } satisfies SelectStatement;
  },

  ColumnList(list) {
    return list.asIteration().children.map((c) => c.toAST()) as unknown as ASTNode;
  },

  ColumnEntry_aliased(expr, _as, alias) {
    if (alias.sourceString.startsWith('"')) {
      throw new SanitiseError("Quoted column aliases are not supported");
    }
    return {
      type: "column",
      expr: expr.toAST() as ColumnExpr,
      alias: { type: "alias", name: alias.toAST() as string } satisfies Alias,
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

  ColumnExpr_expr(val) {
    return {
      type: "column_expr",
      kind: "expr",
      expr: val.toAST() as WhereValue,
    } satisfies ColumnExpr as ASTNode;
  },

  FuncCall(name, _open, args, _close) {
    if (name.sourceString.startsWith('"')) {
      throw new SanitiseError("Quoted function names are not supported");
    }
    return {
      type: "func_call",
      name: name.toAST() as string,
      args: args.toAST() as FuncCallArg,
    } satisfies FuncCall as ASTNode;
  },

  FuncArgs_distinct(_distinct, argList) {
    return {
      kind: "args",
      distinct: true,
      args: argList.toAST() as WhereValue[],
    } as unknown as ASTNode;
  },

  FuncArgs_plain(argList) {
    return {
      kind: "args",
      distinct: false,
      args: argList.toAST() as WhereValue[],
    } as unknown as ASTNode;
  },

  FuncArgs_wildcard(_star) {
    return { kind: "wildcard" } as unknown as ASTNode;
  },

  FuncArgs_empty() {
    return { kind: "args", distinct: false, args: [] } as unknown as ASTNode;
  },

  FuncArgList(list) {
    return list.asIteration().children.map((a) => a.toAST() as WhereValue) as unknown as ASTNode;
  },

  qualifiedWildcard(table, _dot, _star) {
    return {
      type: "column_expr",
      kind: "qualified_wildcard",
      table: table.toAST() as string,
    } satisfies ColumnExpr as ASTNode;
  },

  wildcard(_star) {
    return {
      type: "column_expr",
      kind: "wildcard",
    } satisfies ColumnExpr as ASTNode;
  },

  TableRef_aliased(_tableName, _as, _alias) {
    throw new SanitiseError("Table aliases are not supported, rewrite your query without it");
  },

  TableRef_implicitAlias(_tableName, _alias) {
    throw new SanitiseError("Table aliases are not supported, rewrite your query without it");
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
      schema: schema.toAST() as string,
      name: name.toAST() as string,
    } satisfies TableName as ASTNode;
  },

  TableName_simple(name) {
    return {
      name: name.toAST() as string,
    } satisfies TableName as ASTNode;
  },

  // PostgreSQL: DISTINCT ON (col1, col2, ...)
  DistinctClause_on(_distinct, _on, _open, columns, _close) {
    return {
      type: "distinct_on",
      columns: columns.asIteration().children.map((c) => c.toAST() as WhereValue),
    } satisfies DistinctOn as ASTNode;
  },

  DistinctClause_plain(_distinct) {
    return { type: "distinct" } satisfies Distinct as ASTNode;
  },

  Distinct(_distinct) {
    return { type: "distinct" } satisfies Distinct as ASTNode;
  },

  GroupByClause(_group, _by, items) {
    return {
      type: "group_by",
      items: items.asIteration().children.map((i) => i.toAST() as WhereValue),
    } satisfies GroupByClause as ASTNode;
  },

  HavingClause(_having, expr) {
    return {
      type: "having",
      expr: expr.toAST() as WhereExpr,
    } satisfies HavingClause as ASTNode;
  },

  OrderByClause(_order, _by, items) {
    return {
      type: "order_by",
      items: items.asIteration().children.map((i) => i.toAST() as OrderByItem),
    } satisfies OrderByClause as ASTNode;
  },

  OrderByItem(expr, direction, nullsOrder) {
    const item: OrderByItem = {
      type: "order_by_item",
      expr: expr.toAST() as WhereValue,
    };
    if (direction.children.length > 0) {
      item.direction = direction.children[0]!.toAST() as SortDirection;
    }
    if (nullsOrder.children.length > 0) {
      item.nulls = nullsOrder.children[0]!.toAST() as NullsOrder;
    }
    return item as ASTNode;
  },

  OrderDirection_asc(_asc) {
    return "asc" as unknown as ASTNode;
  },

  OrderDirection_desc(_desc) {
    return "desc" as unknown as ASTNode;
  },

  NullsOrder_first(_nulls, _first) {
    return "nulls_first" as unknown as ASTNode;
  },

  NullsOrder_last(_nulls, _last) {
    return "nulls_last" as unknown as ASTNode;
  },

  LimitClause(_limit, integer) {
    return integer.toAST();
  },

  OffsetClause(_offset, integer) {
    return integer.toAST();
  },

  JoinClause_typed(joinTypeNode, _join, tableRef, condition) {
    return {
      type: "join",
      joinType: joinTypeNode.toAST() as JoinType,
      table: tableRef.toAST() as TableRef,
      condition: condition.toAST() as JoinCondition,
    } satisfies JoinClause as ASTNode;
  },

  JoinClause_bare(_join, tableRef, condition) {
    return {
      type: "join",
      joinType: "inner" as JoinType,
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
      columns: cols.asIteration().children.map((c) => c.toAST() as string),
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

  WhereComparison_compare(left, op, right) {
    return {
      type: "where_comparison",
      operator: op.sourceString as ComparisonOperator,
      left: left.toAST() as WhereValue,
      right: right.toAST() as WhereValue,
    } satisfies WhereComparison as ASTNode;
  },

  WhereComparison_isNotNull(expr, _is, _not, _null) {
    return {
      type: "where_is_null",
      not: true,
      expr: expr.toAST() as WhereValue,
    } satisfies WhereIsNull as ASTNode;
  },

  WhereComparison_isNull(expr, _is, _null) {
    return {
      type: "where_is_null",
      not: false,
      expr: expr.toAST() as WhereValue,
    } satisfies WhereIsNull as ASTNode;
  },

  WhereComparison_isNotBool(expr, _is, _not, b) {
    return {
      type: "where_is_bool",
      not: true,
      expr: expr.toAST() as WhereValue,
      target: b.sourceString.toLowerCase() === "true",
    } satisfies WhereIsBool as ASTNode;
  },

  WhereComparison_isBool(expr, _is, b) {
    return {
      type: "where_is_bool",
      not: false,
      expr: expr.toAST() as WhereValue,
      target: b.sourceString.toLowerCase() === "true",
    } satisfies WhereIsBool as ASTNode;
  },

  WhereComparison_isUnknown(expr, _is, _unknown) {
    return {
      type: "where_is_bool",
      not: false,
      expr: expr.toAST() as WhereValue,
      target: "unknown",
    } satisfies WhereIsBool as ASTNode;
  },

  WhereComparison_isNotUnknown(expr, _is, _not, _unknown) {
    return {
      type: "where_is_bool",
      not: true,
      expr: expr.toAST() as WhereValue,
      target: "unknown" as IsBoolTarget,
    } satisfies WhereIsBool as ASTNode;
  },

  WhereComparison_between(expr, _between, low, _and, high) {
    return {
      type: "where_between",
      not: false,
      expr: expr.toAST() as WhereValue,
      low: low.toAST() as WhereValue,
      high: high.toAST() as WhereValue,
    } satisfies WhereBetween as ASTNode;
  },

  WhereComparison_notBetween(expr, _not, _between, low, _and, high) {
    return {
      type: "where_between",
      not: true,
      expr: expr.toAST() as WhereValue,
      low: low.toAST() as WhereValue,
      high: high.toAST() as WhereValue,
    } satisfies WhereBetween as ASTNode;
  },

  WhereComparison_in(expr, _in, _open, list, _close) {
    return {
      type: "where_in",
      not: false,
      expr: expr.toAST() as WhereValue,
      list: list.asIteration().children.map((v) => v.toAST() as WhereValue),
    } satisfies WhereIn as ASTNode;
  },

  WhereComparison_notIn(expr, _not, _in, _open, list, _close) {
    return {
      type: "where_in",
      not: true,
      expr: expr.toAST() as WhereValue,
      list: list.asIteration().children.map((v) => v.toAST() as WhereValue),
    } satisfies WhereIn as ASTNode;
  },

  WhereComparison_like(expr, _like, pattern) {
    return {
      type: "where_like",
      not: false,
      op: "like" as LikeOp,
      expr: expr.toAST() as WhereValue,
      pattern: pattern.toAST() as WhereValue,
    } satisfies WhereLike as ASTNode;
  },

  // PostgreSQL: case-insensitive LIKE
  WhereComparison_ilike(expr, _ilike, pattern) {
    return {
      type: "where_like",
      not: false,
      op: "ilike" as LikeOp,
      expr: expr.toAST() as WhereValue,
      pattern: pattern.toAST() as WhereValue,
    } satisfies WhereLike as ASTNode;
  },

  // PostgreSQL: case-insensitive NOT LIKE
  WhereComparison_notIlike(expr, _not, _ilike, pattern) {
    return {
      type: "where_like",
      not: true,
      op: "ilike" as LikeOp,
      expr: expr.toAST() as WhereValue,
      pattern: pattern.toAST() as WhereValue,
    } satisfies WhereLike as ASTNode;
  },

  // PostgreSQL: text search match (@@)
  WhereComparison_tsMatch(left, _op, right) {
    return {
      type: "where_ts_match",
      left: left.toAST() as WhereValue,
      right: right.toAST() as WhereValue,
    } satisfies WhereTsMatch as ASTNode;
  },

  WhereComparison_notLike(expr, _not, _like, pattern) {
    return {
      type: "where_like",
      not: true,
      op: "like" as LikeOp,
      expr: expr.toAST() as WhereValue,
      pattern: pattern.toAST() as WhereValue,
    } satisfies WhereLike as ASTNode;
  },

  AddExpr_add(left, _op, right) {
    return {
      type: "where_arith",
      op: "+" as ArithOp,
      left: left.toAST() as WhereValue,
      right: right.toAST() as WhereValue,
    } satisfies WhereArith as ASTNode;
  },

  AddExpr_sub(left, _op, right) {
    return {
      type: "where_arith",
      op: "-" as ArithOp,
      left: left.toAST() as WhereValue,
      right: right.toAST() as WhereValue,
    } satisfies WhereArith as ASTNode;
  },

  AddExpr_concat(left, _op, right) {
    return {
      type: "where_arith",
      op: "||" as ArithOp,
      left: left.toAST() as WhereValue,
      right: right.toAST() as WhereValue,
    } satisfies WhereArith as ASTNode;
  },

  MulExpr_mul(left, _op, right) {
    return {
      type: "where_arith",
      op: "*" as ArithOp,
      left: left.toAST() as WhereValue,
      right: right.toAST() as WhereValue,
    } satisfies WhereArith as ASTNode;
  },

  MulExpr_div(left, _op, right) {
    return {
      type: "where_arith",
      op: "/" as ArithOp,
      left: left.toAST() as WhereValue,
      right: right.toAST() as WhereValue,
    } satisfies WhereArith as ASTNode;
  },

  MulExpr_mod(left, _op, right) {
    return {
      type: "where_arith",
      op: "%" as ArithOp,
      left: left.toAST() as WhereValue,
      right: right.toAST() as WhereValue,
    } satisfies WhereArith as ASTNode;
  },

  // PostgreSQL: JSONB operators
  ExtOpExpr_jsonb(left, op, right) {
    return {
      type: "where_jsonb_op",
      op: op.sourceString as JsonbOp,
      left: left.toAST() as WhereValue,
      right: right.toAST() as WhereValue,
    } satisfies WhereJsonbOp as ASTNode;
  },

  // pgvector: distance operators
  ExtOpExpr_pgvector(left, op, right) {
    return {
      type: "where_pgvector_op",
      op: op.sourceString as PgvectorOp,
      left: left.toAST() as WhereValue,
      right: right.toAST() as WhereValue,
    } satisfies WherePgvectorOp as ASTNode;
  },

  UnaryExpr_neg(_minus, expr) {
    return {
      type: "where_unary_minus",
      expr: expr.toAST() as WhereValue,
    } satisfies WhereUnaryMinus as ASTNode;
  },

  // PostgreSQL: cast shorthand (expr::type)
  PostfixExpr_castShorthand(expr, _colonColon, typeName) {
    return {
      type: "cast_expr",
      expr: expr.toAST() as WhereValue,
      typeName: typeName.sourceString,
    } satisfies CastExpr as ASTNode;
  },

  AtomExpr_case(caseExpr) {
    return caseExpr.toAST();
  },

  AtomExpr_cast(castExpr) {
    return castExpr.toAST();
  },

  CaseExpr_simple(_case, subject, whens, elseClause, _end) {
    return {
      type: "case_expr",
      subject: subject.toAST() as WhereValue,
      whens: whens.children.map((w) => w.toAST() as CaseWhen),
      else: elseClause.children.length > 0 ? (elseClause.children[0]!.toAST() as WhereValue) : null,
    } satisfies CaseExpr as ASTNode;
  },

  CaseExpr_searched(_case, whens, elseClause, _end) {
    return {
      type: "case_expr",
      subject: null,
      whens: whens.children.map((w) => w.toAST() as CaseWhen),
      else: elseClause.children.length > 0 ? (elseClause.children[0]!.toAST() as WhereValue) : null,
    } satisfies CaseExpr as ASTNode;
  },

  SimpleWhenClause(_when, cond, _then, result) {
    return {
      condition: cond.toAST() as WhereValue,
      result: result.toAST() as WhereValue,
    } as unknown as ASTNode;
  },

  SearchedWhenClause(_when, cond, _then, result) {
    return {
      condition: cond.toAST() as WhereValue,
      result: result.toAST() as WhereValue,
    } as unknown as ASTNode;
  },

  ElseClause(_else, val) {
    return val.toAST();
  },

  CastExpr(_cast, _open, expr, _as, typeName, _close) {
    return {
      type: "cast_expr",
      expr: expr.toAST() as WhereValue,
      typeName: typeName.sourceString,
    } satisfies CastExpr as ASTNode;
  },

  AtomExpr_func(funcCall) {
    return {
      type: "where_value",
      kind: "func_call",
      func: funcCall.toAST() as FuncCall,
    } satisfies WhereValue as ASTNode;
  },

  AtomExpr_paren(_open, expr, _close) {
    return expr.toAST();
  },

  AtomExpr_string(s) {
    return {
      type: "where_value",
      kind: "string",
      value: s.toAST() as string,
    } satisfies WhereValue as ASTNode;
  },

  AtomExpr_integer(n) {
    return {
      type: "where_value",
      kind: "integer",
      value: n.toAST() as number,
    } satisfies WhereValue as ASTNode;
  },

  AtomExpr_float(f) {
    return {
      type: "where_value",
      kind: "float",
      value: parseFloat(f.sourceString),
    } satisfies WhereValue as ASTNode;
  },

  AtomExpr_bool(b) {
    return {
      type: "where_value",
      kind: "bool",
      value: b.sourceString.toLowerCase() === "true",
    } satisfies WhereValue as ASTNode;
  },

  AtomExpr_null(_null) {
    return {
      type: "where_value",
      kind: "null",
    } satisfies WhereValue as ASTNode;
  },

  AtomExpr_columnRef(colRef) {
    return {
      type: "where_value",
      kind: "column_ref",
      ref: colRef.toAST() as ColumnRef,
    } satisfies WhereValue as ASTNode;
  },

  ColumnRef_qualified(table, _dot, name) {
    return {
      type: "column_ref",
      table: table.toAST() as string,
      name: name.toAST() as string,
    } satisfies ColumnRef as ASTNode;
  },

  ColumnRef_simple(name) {
    return {
      type: "column_ref",
      name: name.toAST() as string,
    } satisfies ColumnRef as ASTNode;
  },

  stringLiteral(_open, chars, _close) {
    return chars.sourceString as unknown as ASTNode;
  },

  floatLiteral(_int, _dot, _frac) {
    return parseFloat(this.sourceString) as unknown as ASTNode;
  },

  identifier(inner) {
    // Strips quotes from quoted identifiers, returns bare name for unquoted
    return inner.toAST();
  },

  quotedIdentifier(_open, chars, _close) {
    return chars.sourceString as unknown as ASTNode;
  },

  bareIdentifier(_first, _rest) {
    return this.sourceString as unknown as ASTNode;
  },

  integer(_digits) {
    return parseInt(this.sourceString, 10) as unknown as ASTNode;
  },
});

export function parseSql(expr: string): Result<SelectStatement> {
  const matchResult = grammar.match(expr);
  if (matchResult.failed()) {
    return Err(new ParseError(matchResult.message));
  }
  try {
    return Ok(semantics(matchResult).toAST() as SelectStatement);
  } catch (e) {
    if (e instanceof SanitiseError) {
      return Err(e);
    }
    throw e;
  }
}
