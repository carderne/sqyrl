import { expect, test } from "vite-plus/test";

import { parseSql } from "../src";
import { applyGuards } from "../src/guard";
import { outputSql } from "../src/output";

test("round-trips a full statement", () => {
  const sql =
    "SELECT *, foo, mytable.bar, mytable.baz AS qux, mytable.* FROM myschema.mytable WHERE status = 'active' LIMIT 10";
  expect(outputSql(parseSql(sql).unwrap())).toBe(
    `SELECT *, "foo", "mytable"."bar", "mytable"."baz" AS qux, "mytable".* FROM "myschema"."mytable" WHERE "status" = 'active' LIMIT 10`,
  );
});

test("output after sanitise prepends tenant clause", () => {
  const ast = parseSql(
    "SELECT foo FROM bar JOIN myschema.mytable ON mytable.a = bar.a WHERE status = 'active'",
  ).unwrap();
  const result = applyGuards(
    ast,
    [
      {
        schema: "myschema",
        table: "mytable",
        column: "tenant_id",
        value: "abc",
      },
    ],
    10000,
  ).unwrap();
  expect(outputSql(result)).toBe(
    `SELECT "foo" FROM "bar" INNER JOIN "myschema"."mytable" ON "mytable"."a" = "bar"."a" WHERE ("myschema"."mytable"."tenant_id" = 'abc' AND "status" = 'active') LIMIT 10000`,
  );
});

test("output adds parens when OR is nested inside AND", () => {
  const ast = parseSql("SELECT foo FROM bar WHERE (a = '1' OR b = '2') AND c = '3'").unwrap();
  expect(outputSql(ast)).toBe(
    `SELECT "foo" FROM "bar" WHERE (("a" = '1' OR "b" = '2') AND "c" = '3')`,
  );
});

test("output with no WHERE or LIMIT", () => {
  expect(outputSql(parseSql("SELECT x FROM y").unwrap())).toBe(`SELECT "x" FROM "y"`);
});

test("formats a complex SELECT with joins, where, group by, order by, limit, offset", () => {
  const sql = `
  SELECT
    u.id,
    u.name,
    COUNT(o.id) AS order_count,
    SUM(o.total) AS total_spent
  FROM users
  LEFT JOIN orders
    ON orders.user_id = u.id AND orders.status = 'completed'
  INNER JOIN products
    ON products.id = orders.product_id
  WHERE u.active = TRUE AND u.created_at >= '2024-01-01' AND o.total BETWEEN 10 AND 1000
  GROUP BY u.id, u.name
  HAVING COUNT(o.id) > 5
  ORDER BY total_spent DESC
  LIMIT 50
  OFFSET 10
  `;

  const ast = parseSql(sql).unwrap();
  const formatted = outputSql(ast, true);

  expect(formatted).toBe(
    [
      `SELECT`,
      `  "u"."id",`,
      `  "u"."name",`,
      `  COUNT("o"."id") AS order_count,`,
      `  SUM("o"."total") AS total_spent`,
      `FROM "users"`,
      `LEFT JOIN "orders"`,
      `  ON ("orders"."user_id" = "u"."id" AND "orders"."status" = 'completed')`,
      `INNER JOIN "products"`,
      `  ON "products"."id" = "orders"."product_id"`,
      `WHERE (("u"."active" = TRUE AND "u"."created_at" >= '2024-01-01') AND "o"."total" BETWEEN 10 AND 1000)`,
      `GROUP BY "u"."id", "u"."name"`,
      `HAVING COUNT("o"."id") > 5`,
      `ORDER BY "total_spent" DESC`,
      `LIMIT 50`,
      `OFFSET 10`,
    ].join("\n"),
  );
});
