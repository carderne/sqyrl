import { expect, test } from "vite-plus/test";

import { parseSql } from "../src";
import { outputSql } from "../src/output";

// --- Comparison operators ---

test("WHERE with inequality operators output", () => {
  const sql = "SELECT id FROM orders WHERE amount >= 100 AND status <> 'cancelled'";
  expect(outputSql(parseSql(sql).unwrap())).toBe(
    `SELECT "id" FROM "orders" WHERE ("amount" >= 100 AND "status" <> 'cancelled')`,
  );
});

// --- NOT and IS NULL ---

test("WHERE NOT and IS NULL output", () => {
  const sql = "SELECT id FROM users WHERE NOT active = TRUE AND deleted_at IS NULL";
  expect(outputSql(parseSql(sql).unwrap())).toBe(
    `SELECT "id" FROM "users" WHERE (NOT "active" = TRUE AND "deleted_at" IS NULL)`,
  );
});

test("IS NOT NULL round-trip", () => {
  const sql = "SELECT id FROM users WHERE email IS NOT NULL";
  expect(outputSql(parseSql(sql).unwrap())).toBe(
    `SELECT "id" FROM "users" WHERE "email" IS NOT NULL`,
  );
});

// --- JOINs ---

test("INNER JOIN with ON condition output", () => {
  const sql =
    "SELECT users.id, orders.total FROM users INNER JOIN orders ON users.id = orders.user_id";
  expect(outputSql(parseSql(sql).unwrap())).toBe(
    `SELECT "users"."id", "orders"."total" FROM "users" INNER JOIN "orders" ON "users"."id" = "orders"."user_id"`,
  );
});

test("LEFT JOIN with USING output", () => {
  const sql = "SELECT a.id, b.name FROM a LEFT JOIN b USING (id)";
  expect(outputSql(parseSql(sql).unwrap())).toBe(
    `SELECT "a"."id", "b"."name" FROM "a" LEFT JOIN "b" USING (id)`,
  );
});

test("multiple JOINs parse to correct join types", () => {
  const ast = parseSql(
    "SELECT * FROM t1 LEFT OUTER JOIN t2 ON t1.id = t2.id RIGHT JOIN t3 ON t1.id = t3.id",
  ).unwrap();
  expect(ast.joins).toHaveLength(2);
  expect(ast.joins[0].joinType).toBe("left_outer");
  expect(ast.joins[1].joinType).toBe("right");
});

test("CROSS JOIN and NATURAL JOIN", () => {
  const ast = parseSql("SELECT * FROM a CROSS JOIN b NATURAL JOIN c").unwrap();
  expect(ast.joins[0]).toMatchObject({ type: "join", joinType: "cross", condition: null });
  expect(ast.joins[1]).toMatchObject({ type: "join", joinType: "natural", condition: null });
});

// --- CASE WHEN and CAST ---

test("CASE WHEN THEN ELSE END (searched)", () => {
  const sql =
    "SELECT CASE WHEN status = 'active' THEN 1 WHEN status = 'pending' THEN 2 ELSE 0 END FROM t";
  expect(outputSql(parseSql(sql).unwrap())).toBe(
    `SELECT CASE WHEN "status" = 'active' THEN 1 WHEN "status" = 'pending' THEN 2 ELSE 0 END FROM "t"`,
  );
});

test("CASE expr WHEN ... (simple form)", () => {
  const sql = "SELECT CASE status WHEN 'active' THEN 1 ELSE 0 END FROM t";
  expect(outputSql(parseSql(sql).unwrap())).toBe(
    `SELECT CASE "status" WHEN 'active' THEN 1 ELSE 0 END FROM "t"`,
  );
});

test("CAST expression", () => {
  const sql = "SELECT CAST(price AS numeric(10, 2)), CAST(created_at AS date) FROM orders";
  expect(outputSql(parseSql(sql).unwrap())).toBe(
    `SELECT CAST("price" AS numeric(10, 2)), CAST("created_at" AS date) FROM "orders"`,
  );
});

// --- Double-quoted identifiers ---

test("double-quoted identifiers in SELECT and FROM", () => {
  const ast = parseSql('SELECT "My Column", "user id" FROM "My Table"').unwrap();
  expect(ast.columns[0].expr).toMatchObject({ kind: "expr" });
  const col0 = ast.columns[0].expr as any;
  expect(col0.expr.ref.name).toBe("My Column");
  const col1 = ast.columns[1].expr as any;
  expect(col1.expr.ref.name).toBe("user id");
  expect(ast.from.table.name).toBe("My Table");
});

// --- Arithmetic expressions ---

test("arithmetic in SELECT and WHERE", () => {
  const sql = "SELECT price * quantity FROM orders WHERE price * quantity > 100";
  expect(outputSql(parseSql(sql).unwrap())).toBe(
    `SELECT ("price" * "quantity") FROM "orders" WHERE ("price" * "quantity") > 100`,
  );
});

test("string concatenation and unary minus", () => {
  const sql = "SELECT fname || ' ' || lname FROM t WHERE -score < -10";
  expect(outputSql(parseSql(sql).unwrap())).toBe(
    `SELECT (("fname" || ' ') || "lname") FROM "t" WHERE -"score" < -10`,
  );
});

// --- BETWEEN, IN, LIKE, IS TRUE/FALSE/UNKNOWN ---

test("BETWEEN and NOT BETWEEN", () => {
  const sql = "SELECT id FROM t WHERE age BETWEEN 18 AND 65 AND score NOT BETWEEN 0 AND 50";
  expect(outputSql(parseSql(sql).unwrap())).toBe(
    `SELECT "id" FROM "t" WHERE ("age" BETWEEN 18 AND 65 AND "score" NOT BETWEEN 0 AND 50)`,
  );
});

test("IN list and NOT IN list", () => {
  const sql =
    "SELECT id FROM t WHERE status IN ('active', 'pending') AND role NOT IN ('admin', 'root')";
  expect(outputSql(parseSql(sql).unwrap())).toBe(
    `SELECT "id" FROM "t" WHERE ("status" IN ('active', 'pending') AND "role" NOT IN ('admin', 'root'))`,
  );
});

test("LIKE and NOT LIKE", () => {
  const sql = "SELECT id FROM t WHERE name LIKE '%foo%' AND email NOT LIKE '%bar%'";
  expect(outputSql(parseSql(sql).unwrap())).toBe(
    `SELECT "id" FROM "t" WHERE ("name" LIKE '%foo%' AND "email" NOT LIKE '%bar%')`,
  );
});

test("IS TRUE / IS FALSE / IS UNKNOWN", () => {
  const sql = "SELECT id FROM t WHERE active IS TRUE AND deleted IS NOT FALSE AND flag IS UNKNOWN";
  expect(outputSql(parseSql(sql).unwrap())).toBe(
    `SELECT "id" FROM "t" WHERE (("active" IS TRUE AND "deleted" IS NOT FALSE) AND "flag" IS UNKNOWN)`,
  );
});

// --- Function calls ---

test("function calls in SELECT and WHERE", () => {
  const sql =
    "SELECT count(*), lower(name), coalesce(email, 'none') FROM users WHERE length(name) > 3";
  expect(outputSql(parseSql(sql).unwrap())).toBe(
    `SELECT count(*), lower("name"), coalesce("email", 'none') FROM "users" WHERE length("name") > 3`,
  );
});

test("aggregate with DISTINCT", () => {
  const sql = "SELECT count(DISTINCT user_id) FROM events";
  expect(outputSql(parseSql(sql).unwrap())).toBe(`SELECT count(DISTINCT "user_id") FROM "events"`);
});

// --- DISTINCT ---

test("SELECT DISTINCT output", () => {
  const sql = "SELECT DISTINCT status FROM orders";
  expect(outputSql(parseSql(sql).unwrap())).toBe(`SELECT DISTINCT "status" FROM "orders"`);
});

// --- GROUP BY / HAVING ---

test("GROUP BY with HAVING output", () => {
  const sql =
    "SELECT status, count FROM orders GROUP BY status HAVING count > 10 ORDER BY count DESC";
  expect(outputSql(parseSql(sql).unwrap())).toBe(
    `SELECT "status", "count" FROM "orders" GROUP BY "status" HAVING "count" > 10 ORDER BY "count" DESC`,
  );
});

// --- ORDER BY / OFFSET ---

test("ORDER BY with direction and NULLS order", () => {
  const sql =
    "SELECT id, name FROM users ORDER BY name ASC NULLS FIRST, id DESC NULLS LAST LIMIT 10 OFFSET 20";
  expect(outputSql(parseSql(sql).unwrap())).toBe(
    `SELECT "id", "name" FROM "users" ORDER BY "name" ASC NULLS FIRST, "id" DESC NULLS LAST LIMIT 10 OFFSET 20`,
  );
});

test("ORDER BY without direction", () => {
  const ast = parseSql("SELECT x FROM t ORDER BY x").unwrap();
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
  const ast = parseSql("SELECT x FROM t WHERE age > 18").unwrap();
  expect(ast.where?.inner).toEqual({
    type: "where_comparison",
    operator: ">",
    left: { type: "where_value", kind: "column_ref", ref: { type: "column_ref", name: "age" } },
    right: { type: "where_value", kind: "integer", value: 18 },
  });
});

test("WHERE with float RHS literal", () => {
  const ast = parseSql("SELECT x FROM t WHERE score >= 9.5").unwrap();
  expect(ast.where?.inner).toEqual({
    type: "where_comparison",
    operator: ">=",
    left: { type: "where_value", kind: "column_ref", ref: { type: "column_ref", name: "score" } },
    right: { type: "where_value", kind: "float", value: 9.5 },
  });
});

test("WHERE with boolean RHS literal", () => {
  const ast = parseSql("SELECT x FROM t WHERE active = TRUE").unwrap();
  expect(ast.where?.inner).toEqual({
    type: "where_comparison",
    operator: "=",
    left: { type: "where_value", kind: "column_ref", ref: { type: "column_ref", name: "active" } },
    right: { type: "where_value", kind: "bool", value: true },
  });
});

test("WHERE with NULL value RHS", () => {
  const ast = parseSql("SELECT x FROM t WHERE col = NULL").unwrap();
  expect(ast.where?.inner).toEqual({
    type: "where_comparison",
    operator: "=",
    left: { type: "where_value", kind: "column_ref", ref: { type: "column_ref", name: "col" } },
    right: { type: "where_value", kind: "null" },
  });
});
