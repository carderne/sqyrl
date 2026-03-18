import { expect, test } from "vite-plus/test";

import { parseSql } from "../src";
import { sanitiseSql } from "../src/sanitise";

test("sanitise adds WHERE clause when none exists", () => {
  const ast = parseSql("SELECT foo FROM bar");
  const result = sanitiseSql({
    ast,
    schema: "myschema",
    table: "mytable",
    col: "tenant_id",
    value: "abc",
  });

  expect(result.where).toEqual({
    type: "where_root",
    inner: {
      type: "where_comparison",
      operator: "=",
      column: { type: "column_ref", table: "myschema.mytable", name: "tenant_id" },
      value: "abc",
    },
  });
});

test("sanitise prepends to existing WHERE as top-level AND", () => {
  const ast = parseSql("SELECT foo FROM bar WHERE status = 'active'");
  const result = sanitiseSql({
    ast,
    schema: "myschema",
    table: "mytable",
    col: "tenant_id",
    value: "abc",
  });

  expect(result.where).toEqual({
    type: "where_root",
    inner: {
      type: "where_and",
      left: {
        type: "where_comparison",
        operator: "=",
        column: { type: "column_ref", table: "myschema.mytable", name: "tenant_id" },
        value: "abc",
      },
      right: {
        type: "where_comparison",
        operator: "=",
        column: { type: "column_ref", name: "status" },
        value: "active",
      },
    },
  });
});
