import { expect, test } from "vite-plus/test";

import { agentSql, createAgentSql, defineSchema } from "../src";

test("agentSql with minimum args", () => {
  expect(agentSql("SELECT * FROM msg", "msg.user_id", 123)).toBe(
    `SELECT * FROM "msg" WHERE "msg"."user_id" = 123 LIMIT 10000`,
  );
});

test("agentSql with schema and limit", () => {
  const schema = defineSchema({ msg: {}, user: {} });
  expect(agentSql("SELECT * FROM msg", "msg.user_id", 123, { schema, limit: 50 })).toBe(
    `SELECT * FROM "msg" WHERE "msg"."user_id" = 123 LIMIT 50`,
  );
});

test("factory returns a function that injects a tenant guard into SQL", () => {
  const query = createAgentSql({
    column: "orders.tenant_id",
    value: "t42",
    schema: defineSchema({ orders: {} }),
  });

  expect(query("SELECT id FROM orders WHERE status = 'open'")).toBe(
    `SELECT "id" FROM "orders" WHERE ("orders"."tenant_id" = 't42' AND "status" = 'open') LIMIT 10000`,
  );
});
