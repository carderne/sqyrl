import { expect, test } from "vite-plus/test";

import { parseSql } from "../src";
import { outputSql } from "../src/output";
import { sanitiseSql } from "../src/sanitise";

test("round-trips a full statement", () => {
  const sql =
    "SELECT *, foo, t.bar, t.baz AS qux, t.* FROM myschema.mytable AS t WHERE status = 'active' LIMIT 10";
  expect(outputSql(parseSql(sql))).toBe(sql);
});

test("output after sanitise prepends tenant clause", () => {
  const ast = parseSql("SELECT foo FROM bar WHERE status = 'active'");
  const result = sanitiseSql({
    ast,
    schema: "myschema",
    table: "mytable",
    col: "tenant_id",
    value: "abc",
  });
  expect(outputSql(result)).toBe(
    "SELECT foo FROM bar WHERE (myschema.mytable.tenant_id = 'abc' AND status = 'active')",
  );
});

test("output adds parens when OR is nested inside AND", () => {
  const ast = parseSql("SELECT foo FROM bar WHERE (a = '1' OR b = '2') AND c = '3'");
  expect(outputSql(ast)).toBe("SELECT foo FROM bar WHERE ((a = '1' OR b = '2') AND c = '3')");
});

test("output with no WHERE or LIMIT", () => {
  expect(outputSql(parseSql("SELECT x FROM y"))).toBe("SELECT x FROM y");
});
