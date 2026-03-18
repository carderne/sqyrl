import { expect, test } from "vite-plus/test";

import { parseSql } from "../src";
import { outputSql } from "../src/output";

// --- Comparison operators ---

test("WHERE with inequality operators output", () => {
  const sql = "SELECT id FROM orders WHERE amount >= 100 AND status <> 'cancelled'";
  expect(outputSql(parseSql(sql))).toBe(
    "SELECT id FROM orders WHERE (amount >= 100 AND status <> 'cancelled')",
  );
});

// --- NOT and IS NULL ---

test("WHERE NOT and IS NULL output", () => {
  const sql = "SELECT id FROM users WHERE NOT active = TRUE AND deleted_at IS NULL";
  expect(outputSql(parseSql(sql))).toBe(
    "SELECT id FROM users WHERE (NOT active = TRUE AND deleted_at IS NULL)",
  );
});

test("IS NOT NULL round-trip", () => {
  const sql = "SELECT id FROM users WHERE email IS NOT NULL";
  expect(outputSql(parseSql(sql))).toBe(sql);
});

// --- Numeric and boolean RHS literals ---

test("WHERE with integer RHS literal", () => {
  const ast = parseSql("SELECT x FROM t WHERE age > 18");
  expect(ast.where?.inner).toEqual({
    type: "where_comparison",
    operator: ">",
    column: { type: "column_ref", name: "age" },
    value: { type: "where_value", kind: "integer", value: 18 },
  });
});

test("WHERE with float RHS literal", () => {
  const ast = parseSql("SELECT x FROM t WHERE score >= 9.5");
  expect(ast.where?.inner).toEqual({
    type: "where_comparison",
    operator: ">=",
    column: { type: "column_ref", name: "score" },
    value: { type: "where_value", kind: "float", value: 9.5 },
  });
});

test("WHERE with boolean RHS literal", () => {
  const ast = parseSql("SELECT x FROM t WHERE active = TRUE");
  expect(ast.where?.inner).toEqual({
    type: "where_comparison",
    operator: "=",
    column: { type: "column_ref", name: "active" },
    value: { type: "where_value", kind: "bool", value: true },
  });
});

test("WHERE with NULL value RHS", () => {
  const ast = parseSql("SELECT x FROM t WHERE col = NULL");
  expect(ast.where?.inner).toEqual({
    type: "where_comparison",
    operator: "=",
    column: { type: "column_ref", name: "col" },
    value: { type: "where_value", kind: "null" },
  });
});
