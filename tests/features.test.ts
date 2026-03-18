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

// --- JOINs ---

test("INNER JOIN with ON condition output", () => {
  const sql = "SELECT u.id, o.total FROM users AS u INNER JOIN orders AS o ON u.id = o.user_id";
  expect(outputSql(parseSql(sql))).toBe(sql);
});

test("LEFT JOIN with USING output", () => {
  const sql = "SELECT a.id, b.name FROM a LEFT JOIN b USING (id)";
  expect(outputSql(parseSql(sql))).toBe(sql);
});

test("multiple JOINs parse to correct join types", () => {
  const ast = parseSql(
    "SELECT * FROM t1 LEFT OUTER JOIN t2 ON t1.id = t2.id RIGHT JOIN t3 ON t1.id = t3.id",
  );
  expect(ast.joins).toHaveLength(2);
  expect(ast.joins[0].joinType).toBe("left_outer");
  expect(ast.joins[1].joinType).toBe("right");
});

test("CROSS JOIN and NATURAL JOIN", () => {
  const ast = parseSql("SELECT * FROM a CROSS JOIN b NATURAL JOIN c");
  expect(ast.joins[0]).toMatchObject({ type: "join", joinType: "cross", condition: null });
  expect(ast.joins[1]).toMatchObject({ type: "join", joinType: "natural", condition: null });
});

// --- ORDER BY / OFFSET ---

test("ORDER BY with direction and NULLS order", () => {
  const sql =
    "SELECT id, name FROM users ORDER BY name ASC NULLS FIRST, id DESC NULLS LAST LIMIT 10 OFFSET 20";
  expect(outputSql(parseSql(sql))).toBe(sql);
});

test("ORDER BY without direction", () => {
  const ast = parseSql("SELECT x FROM t ORDER BY x");
  expect(ast.orderBy).toEqual({
    type: "order_by",
    items: [
      {
        type: "order_by_item",
        expr: { type: "where_value", kind: "column_ref", ref: { type: "column_ref", name: "x" } },
      },
    ],
  });
  expect(ast.offset).toBeNull();
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
