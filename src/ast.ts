export type ASTNode =
  | SelectStatement
  | Column
  | Alias
  | SelectFrom
  | TableRef
  | ColumnExpr
  | WhereRoot
  | WhereExpr
  | ColumnRef
  | LimitClause;

export type Terminal = string | number | null | undefined;

export interface SelectStatement {
  readonly type: "select";
  columns: Column[];
  from: SelectFrom;
  where: WhereRoot | null;
  limit: LimitClause | null;
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

export type WhereExpr = WhereAnd | WhereOr | WhereComparison;

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

export interface WhereComparison {
  readonly type: "where_comparison";
  operator: "=";
  column: ColumnRef;
  value: string;
}

export interface ColumnRef {
  readonly type: "column_ref";
  schema?: string;
  table?: string;
  name: string;
}

export interface ColumnExpr {
  readonly type: "column_expr";
  kind: "wildcard" | "qualified_wildcard" | "qualified" | "simple";
  schema?: string;
  table?: string;
  name?: string;
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
  alias?: Alias;
}

export interface TableName {
  schema?: string;
  name: string;
}
