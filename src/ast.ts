export type ASTNode =
  | SelectStatement
  | Column
  | Alias
  | SelectFrom
  | TableRef
  | ColumnExpr
  | WhereRoot
  | WhereExpr
  | WhereValue
  | ColumnRef
  | FuncCall
  | JoinClause
  | JoinCondition
  | Distinct
  | GroupByClause
  | HavingClause
  | OrderByClause
  | OrderByItem
  | LimitClause
  | OffsetClause;
// Note: WhereIsBool, WhereBetween, WhereIn, WhereLike are covered by WhereExpr above

export type Terminal = string | number | null | undefined;

export interface SelectStatement {
  readonly type: "select";
  distinct: Distinct | null;
  columns: Column[];
  from: SelectFrom;
  joins: JoinClause[];
  where: WhereRoot | null;
  groupBy: GroupByClause | null;
  having: HavingClause | null;
  orderBy: OrderByClause | null;
  limit: LimitClause | null;
  offset: OffsetClause | null;
}

export interface Distinct {
  readonly type: "distinct";
}

export interface GroupByClause {
  readonly type: "group_by";
  items: WhereValue[];
}

export interface HavingClause {
  readonly type: "having";
  expr: WhereExpr;
}

export interface OrderByClause {
  readonly type: "order_by";
  items: OrderByItem[];
}

export type SortDirection = "asc" | "desc";
export type NullsOrder = "nulls_first" | "nulls_last";

export interface OrderByItem {
  readonly type: "order_by_item";
  expr: WhereValue;
  direction?: SortDirection;
  nulls?: NullsOrder;
}

export interface OffsetClause {
  readonly type: "offset";
  value: number;
}

export type JoinType =
  | "inner"
  | "inner_outer"
  | "left"
  | "left_outer"
  | "right"
  | "right_outer"
  | "full"
  | "full_outer"
  | "cross"
  | "natural";

export type JoinCondition =
  | { readonly type: "join_on"; expr: WhereExpr }
  | { readonly type: "join_using"; columns: string[] };

export interface JoinClause {
  readonly type: "join";
  joinType: JoinType;
  table: TableRef;
  condition: JoinCondition | null;
}

export type SelectFrom = {
  readonly type: "select_from";
  table: TableRef;
};

export type LimitClause = {
  readonly type: "limit";
  value: number;
};

export type WhereRoot = {
  readonly type: "where_root";
  inner: WhereExpr;
};

export type WhereExpr =
  | WhereAnd
  | WhereOr
  | WhereNot
  | WhereComparison
  | WhereIsNull
  | WhereIsBool
  | WhereBetween
  | WhereIn
  | WhereLike;

export interface WhereAnd {
  readonly type: "where_and";
  left: WhereExpr;
  right: WhereExpr;
}

export interface WhereOr {
  readonly type: "where_or";
  left: WhereExpr;
  right: WhereExpr;
}

export type ComparisonOperator = "=" | "<>" | "!=" | "<" | ">" | "<=" | ">=";

export interface WhereNot {
  readonly type: "where_not";
  expr: WhereExpr;
}

export interface WhereIsNull {
  readonly type: "where_is_null";
  not: boolean;
  expr: WhereValue;
}

export type IsBoolTarget = boolean | "unknown";

export interface WhereIsBool {
  readonly type: "where_is_bool";
  not: boolean;
  expr: WhereValue;
  target: IsBoolTarget;
}

export interface WhereBetween {
  readonly type: "where_between";
  not: boolean;
  expr: WhereValue;
  low: WhereValue;
  high: WhereValue;
}

export interface WhereIn {
  readonly type: "where_in";
  not: boolean;
  expr: WhereValue;
  list: WhereValue[];
}

export type LikeOp = "like";

export interface WhereLike {
  readonly type: "where_like";
  not: boolean;
  op: LikeOp;
  expr: WhereValue;
  pattern: WhereValue;
}

export type ArithOp = "+" | "-" | "*" | "/" | "%" | "||";

export interface WhereArith {
  readonly type: "where_arith";
  op: ArithOp;
  left: WhereValue;
  right: WhereValue;
}

export interface WhereUnaryMinus {
  readonly type: "where_unary_minus";
  expr: WhereValue;
}

export interface CaseWhen {
  condition: WhereValue;
  result: WhereValue;
}

export interface CaseExpr {
  readonly type: "case_expr";
  subject: WhereValue | null; // null = searched CASE, non-null = simple CASE
  whens: CaseWhen[];
  else: WhereValue | null;
}

export interface CastExpr {
  readonly type: "cast_expr";
  expr: WhereValue;
  typeName: string;
}

export type WhereValue =
  | { readonly type: "where_value"; kind: "string"; value: string }
  | { readonly type: "where_value"; kind: "integer"; value: number }
  | { readonly type: "where_value"; kind: "float"; value: number }
  | { readonly type: "where_value"; kind: "bool"; value: boolean }
  | { readonly type: "where_value"; kind: "null" }
  | { readonly type: "where_value"; kind: "column_ref"; ref: ColumnRef }
  | { readonly type: "where_value"; kind: "func_call"; func: FuncCall }
  | WhereArith
  | WhereUnaryMinus
  | CaseExpr
  | CastExpr;

export interface WhereComparison {
  readonly type: "where_comparison";
  operator: ComparisonOperator;
  left: WhereValue;
  right: WhereValue;
}

export interface ColumnRef {
  readonly type: "column_ref";
  schema?: string;
  table?: string;
  name: string;
}

export type FuncCallArg =
  | { kind: "wildcard" }
  | { kind: "args"; distinct: boolean; args: WhereValue[] };

export interface FuncCall {
  readonly type: "func_call";
  name: string;
  args: FuncCallArg;
}

export interface ColumnExpr {
  readonly type: "column_expr";
  kind: "wildcard" | "qualified_wildcard" | "expr";
  table?: string;
  expr?: WhereValue;
}

export interface Column {
  readonly type: "column";
  expr: ColumnExpr;
  alias?: Alias;
}

export interface Alias {
  readonly type: "alias";
  name: string;
}

export interface TableRef {
  readonly type: "table_ref";
  schema?: string;
  name: string;
}

export interface TableName {
  schema?: string;
  name: string;
}
