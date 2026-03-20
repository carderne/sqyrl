import { expect, test } from "vite-plus/test";

import { parseSql } from "../src";
import { addGuards } from "../src/guard";

test("sanitise adds WHERE clause when none exists", () => {
  const ast = parseSql("SELECT foo FROM mytable").unwrap();
  const result = addGuards(ast, {
    table: "mytable",
    column: "tenant_id",
    value: "abc",
  }).unwrap();

  expect(result.where).toEqual({
    type: "where_root",
    inner: {
      type: "where_comparison",
      operator: "=",
      left: {
        type: "where_value",
        kind: "column_ref",
        ref: { type: "column_ref", table: "mytable", name: "tenant_id" },
      },
      right: { type: "where_value", kind: "string", value: "abc" },
    },
  });
});

test("sanitise prepends to existing WHERE as top-level AND", () => {
  const ast = parseSql("SELECT foo FROM mytable WHERE status = 'active'").unwrap();
  const result = addGuards(ast, {
    table: "mytable",
    column: "tenant_id",
    value: "abc",
  }).unwrap();

  expect(result.where).toEqual({
    type: "where_root",
    inner: {
      type: "where_and",
      left: {
        type: "where_comparison",
        operator: "=",
        left: {
          type: "where_value",
          kind: "column_ref",
          ref: { type: "column_ref", table: "mytable", name: "tenant_id" },
        },
        right: { type: "where_value", kind: "string", value: "abc" },
      },
      right: {
        type: "where_comparison",
        operator: "=",
        left: {
          type: "where_value",
          kind: "column_ref",
          ref: { type: "column_ref", name: "status" },
        },
        right: { type: "where_value", kind: "string", value: "active" },
      },
    },
  });
});
