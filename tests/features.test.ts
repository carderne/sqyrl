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

// --- BETWEEN, IN, LIKE, IS TRUE/FALSE/UNKNOWN ---

test("BETWEEN and NOT BETWEEN", () => {
  const sql = "SELECT id FROM t WHERE age BETWEEN 18 AND 65 AND score NOT BETWEEN 0 AND 50";
  expect(outputSql(parseSql(sql))).toBe(
    "SELECT id FROM t WHERE (age BETWEEN 18 AND 65 AND score NOT BETWEEN 0 AND 50)",
  );
});

test("IN list and NOT IN list", () => {
  const sql =
    "SELECT id FROM t WHERE status IN ('active', 'pending') AND role NOT IN ('admin', 'root')";
  expect(outputSql(parseSql(sql))).toBe(
    "SELECT id FROM t WHERE (status IN ('active', 'pending') AND role NOT IN ('admin', 'root'))",
  );
});

test("LIKE and ILIKE and negations", () => {
  const sql = "SELECT id FROM t WHERE name LIKE '%foo%' AND email NOT ILIKE '%bar%'";
  expect(outputSql(parseSql(sql))).toBe(
    "SELECT id FROM t WHERE (name LIKE '%foo%' AND email NOT ILIKE '%bar%')",
  );
});

test("IS TRUE / IS FALSE / IS UNKNOWN", () => {
  const sql = "SELECT id FROM t WHERE active IS TRUE AND deleted IS NOT FALSE AND flag IS UNKNOWN";
  expect(outputSql(parseSql(sql))).toBe(
    "SELECT id FROM t WHERE ((active IS TRUE AND deleted IS NOT FALSE) AND flag IS UNKNOWN)",
  );
});

// --- Function calls ---

test("function calls in SELECT and WHERE", () => {
  const sql =
    "SELECT count(*), lower(name), coalesce(email, 'none') FROM users WHERE length(name) > 3";
  expect(outputSql(parseSql(sql))).toBe(sql);
});

test("aggregate with DISTINCT", () => {
  const sql = "SELECT count(DISTINCT user_id) FROM events";
  expect(outputSql(parseSql(sql))).toBe(sql);
});

// --- DISTINCT ---

test("SELECT DISTINCT output", () => {
  const sql = "SELECT DISTINCT status FROM orders";
  expect(outputSql(parseSql(sql))).toBe(sql);
});

test("SELECT DISTINCT ON output", () => {
  const sql = "SELECT DISTINCT ON (user_id) id, user_id FROM events ORDER BY user_id, id DESC";
  expect(outputSql(parseSql(sql))).toBe(sql);
});

// --- GROUP BY / HAVING ---

test("GROUP BY with HAVING output", () => {
  const sql =
    "SELECT status, count FROM orders GROUP BY status HAVING count > 10 ORDER BY count DESC";
  expect(outputSql(parseSql(sql))).toBe(sql);
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
    left: { type: "where_value", kind: "column_ref", ref: { type: "column_ref", name: "age" } },
    right: { type: "where_value", kind: "integer", value: 18 },
  });
});

test("WHERE with float RHS literal", () => {
  const ast = parseSql("SELECT x FROM t WHERE score >= 9.5");
  expect(ast.where?.inner).toEqual({
    type: "where_comparison",
    operator: ">=",
    left: { type: "where_value", kind: "column_ref", ref: { type: "column_ref", name: "score" } },
    right: { type: "where_value", kind: "float", value: 9.5 },
  });
});

test("WHERE with boolean RHS literal", () => {
  const ast = parseSql("SELECT x FROM t WHERE active = TRUE");
  expect(ast.where?.inner).toEqual({
    type: "where_comparison",
    operator: "=",
    left: { type: "where_value", kind: "column_ref", ref: { type: "column_ref", name: "active" } },
    right: { type: "where_value", kind: "bool", value: true },
  });
});

test("WHERE with NULL value RHS", () => {
  const ast = parseSql("SELECT x FROM t WHERE col = NULL");
  expect(ast.where?.inner).toEqual({
    type: "where_comparison",
    operator: "=",
    left: { type: "where_value", kind: "column_ref", ref: { type: "column_ref", name: "col" } },
    right: { type: "where_value", kind: "null" },
  });
});
