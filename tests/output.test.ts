import { expect, test } from "vite-plus/test";

import { parseSql } from "../src";
import { outputSql } from "../src/output";
import { addGuards } from "../src/guard";

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
  const result = addGuards(ast, {
    schema: "myschema",
    table: "mytable",
    column: "tenant_id",
    value: "abc",
  }).unwrap();
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
