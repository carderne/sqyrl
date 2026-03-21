import { expect, test } from "vite-plus/test";

import { parseSql } from "../src";
import { applyGuards } from "../src/guard";

test("sanitise adds WHERE clause when none exists", () => {
  const ast = parseSql("SELECT foo FROM mytable").unwrap();
  const result = applyGuards(
    ast,
    [
      {
        table: "mytable",
        column: "tenant_id",
        value: "abc",
      },
    ],
    10000,
  ).unwrap();

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
  const result = applyGuards(
    ast,
    [
      {
        table: "mytable",
        column: "tenant_id",
        value: "abc",
      },
    ],
    10000,
  ).unwrap();

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

test("multiple guards are ANDed together", () => {
  const ast = parseSql(
    "SELECT o.id FROM orders JOIN users ON orders.user_id = uusers.id WHERE orders.total > 100",
  ).unwrap();
  const result = applyGuards(
    ast,
    [
      { table: "orders", column: "tenant_id", value: "t1" },
      { table: "users", column: "org_id", value: 42 },
    ],
    10000,
  ).unwrap();

  // The two guards should be ANDed together, then ANDed with the original WHERE
  expect(result.where).toEqual({
    type: "where_root",
    inner: {
      type: "where_and",
      // left = combined guards (guard1 AND guard2)
      left: {
        type: "where_and",
        left: {
          type: "where_comparison",
          operator: "=",
          left: {
            type: "where_value",
            kind: "column_ref",
            ref: { type: "column_ref", table: "orders", name: "tenant_id" },
          },
          right: { type: "where_value", kind: "string", value: "t1" },
        },
        right: {
          type: "where_comparison",
          operator: "=",
          left: {
            type: "where_value",
            kind: "column_ref",
            ref: { type: "column_ref", table: "users", name: "org_id" },
          },
          right: { type: "where_value", kind: "integer", value: 42 },
        },
      },
      // right = original WHERE clause
      right: {
        type: "where_comparison",
        operator: ">",
        left: {
          type: "where_value",
          kind: "column_ref",
          ref: { type: "column_ref", table: "orders", name: "total" },
        },
        right: { type: "where_value", kind: "integer", value: 100 },
      },
    },
  });
});
