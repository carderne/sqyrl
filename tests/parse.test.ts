import { expect, test } from "vite-plus/test";

import { parseSql } from "../src";

test("parses full example with all column types", () => {
  const sql = `
SELECT
  *, -- should accept an asterisk
  foo, -- also should just ignore comments
  table1.bar, -- also fully qualified
  table1.baz as qux, -- and renames
  table1.*  -- no comma on last entry
FROM optional_schema.table1 AS fo -- column entries can also have schema, "AS" is optional
LIMIT 10;
  `.trim();
  const ast = parseSql(sql);

  expect(ast).toEqual({
    type: "select",
    distinct: null,
    columns: [
      { type: "column", expr: wildExpr },
      { type: "column", expr: colExpr("foo") },
      { type: "column", expr: colExpr("bar", "table1") },
      { type: "column", expr: colExpr("baz", "table1"), alias: { type: "alias", name: "qux" } },
      { type: "column", expr: qualWildExpr("table1") },
    ],
    from: {
      type: "select_from",
      table: {
        type: "table_ref",
        schema: "optional_schema",
        name: "table1",
        alias: { type: "alias", name: "fo" },
      },
    },
    joins: [],
    where: null,
    groupBy: null,
    having: null,
    orderBy: null,
    limit: { type: "limit", value: 10 },
    offset: null,
  });
});

test("parses simple select without limit", () => {
  const ast = parseSql("SELECT foo FROM bar");
  expect(ast).toEqual({
    type: "select",
    distinct: null,
    columns: [{ type: "column", expr: colExpr("foo") }],
    from: { type: "select_from", table: { type: "table_ref", name: "bar" } },
    joins: [],
    where: null,
    groupBy: null,
    having: null,
    orderBy: null,
    limit: null,
    offset: null,
  });
});

test("parses table with implicit alias", () => {
  const ast = parseSql("SELECT a FROM schema1.tbl t");
  expect(ast).toEqual({
    type: "select",
    distinct: null,
    columns: [{ type: "column", expr: colExpr("a") }],
    from: {
      type: "select_from",
      table: {
        type: "table_ref",
        schema: "schema1",
        name: "tbl",
        alias: { type: "alias", name: "t" },
      },
    },
    joins: [],
    where: null,
    groupBy: null,
    having: null,
    orderBy: null,
    limit: null,
    offset: null,
  });
});

test("parses trailing semicolon as optional", () => {
  const withSemi = parseSql("SELECT x FROM y;");
  const withoutSemi = parseSql("SELECT x FROM y");
  expect(withSemi).toEqual(withoutSemi);
});

test("is case-insensitive for keywords", () => {
  const ast = parseSql("select foo from bar limit 5");
  expect(ast).toEqual({
    type: "select",
    distinct: null,
    columns: [{ type: "column", expr: colExpr("foo") }],
    from: { type: "select_from", table: { type: "table_ref", name: "bar" } },
    joins: [],
    where: null,
    groupBy: null,
    having: null,
    orderBy: null,
    limit: { type: "limit", value: 5 },
    offset: null,
  });
});

test("throws on invalid SQL", () => {
  expect(() => parseSql("INVALID")).toThrow();
});

const strVal = (v: string) => ({ type: "where_value", kind: "string", value: v }) as const;
const colRef = (name: string, table?: string) =>
  ({
    type: "where_value",
    kind: "column_ref",
    ref: { type: "column_ref", ...(table ? { table } : {}), name },
  }) as const;
const colExpr = (name: string, table?: string) =>
  ({
    type: "column_expr",
    kind: "expr",
    expr: colRef(name, table),
  }) as const;
const wildExpr = { type: "column_expr", kind: "wildcard" } as const;
const qualWildExpr = (table: string) =>
  ({ type: "column_expr", kind: "qualified_wildcard", table }) as const;

test("parses simple WHERE clause", () => {
  const ast = parseSql("SELECT foo FROM bar WHERE baz = 'hello'");
  expect(ast.where).toEqual({
    type: "where_root",
    inner: {
      type: "where_comparison",
      operator: "=",
      left: colRef("baz"),
      right: strVal("hello"),
    },
  });
});

test("parses WHERE with qualified column ref", () => {
  const ast = parseSql("SELECT foo FROM bar WHERE t.baz = 'hello'");
  expect(ast.where).toEqual({
    type: "where_root",
    inner: {
      type: "where_comparison",
      operator: "=",
      left: colRef("baz", "t"),
      right: strVal("hello"),
    },
  });
});

test("parses WHERE with AND", () => {
  const ast = parseSql("SELECT foo FROM bar WHERE a = '1' AND b = '2'");
  expect(ast.where).toEqual({
    type: "where_root",
    inner: {
      type: "where_and",
      left: {
        type: "where_comparison",
        operator: "=",
        left: colRef("a"),
        right: strVal("1"),
      },
      right: {
        type: "where_comparison",
        operator: "=",
        left: colRef("b"),
        right: strVal("2"),
      },
    },
  });
});

test("parses WHERE with OR", () => {
  const ast = parseSql("SELECT foo FROM bar WHERE a = '1' OR b = '2'");
  expect(ast.where).toEqual({
    type: "where_root",
    inner: {
      type: "where_or",
      left: {
        type: "where_comparison",
        operator: "=",
        left: colRef("a"),
        right: strVal("1"),
      },
      right: {
        type: "where_comparison",
        operator: "=",
        left: colRef("b"),
        right: strVal("2"),
      },
    },
  });
});

test("parses WHERE with AND having higher precedence than OR", () => {
  // a = '1' OR b = '2' AND c = '3'  →  a OR (b AND c)
  const ast = parseSql("SELECT foo FROM bar WHERE a = '1' OR b = '2' AND c = '3'");
  expect(ast.where).toEqual({
    type: "where_root",
    inner: {
      type: "where_or",
      left: {
        type: "where_comparison",
        operator: "=",
        left: colRef("a"),
        right: strVal("1"),
      },
      right: {
        type: "where_and",
        left: {
          type: "where_comparison",
          operator: "=",
          left: colRef("b"),
          right: strVal("2"),
        },
        right: {
          type: "where_comparison",
          operator: "=",
          left: colRef("c"),
          right: strVal("3"),
        },
      },
    },
  });
});

test("parses WHERE with parens overriding precedence", () => {
  // (a = '1' OR b = '2') AND c = '3'
  const ast = parseSql("SELECT foo FROM bar WHERE (a = '1' OR b = '2') AND c = '3'");
  expect(ast.where).toEqual({
    type: "where_root",
    inner: {
      type: "where_and",
      left: {
        type: "where_or",
        left: {
          type: "where_comparison",
          operator: "=",
          left: colRef("a"),
          right: strVal("1"),
        },
        right: {
          type: "where_comparison",
          operator: "=",
          left: colRef("b"),
          right: strVal("2"),
        },
      },
      right: {
        type: "where_comparison",
        operator: "=",
        left: colRef("c"),
        right: strVal("3"),
      },
    },
  });
});
