import { expect, test } from "vite-plus/test";

import { resolveGuardAliases, insertNeededGuardJoins } from "../src/graph";
import type { WhereGuard } from "../src/guard";
import { defineSchema } from "../src/joins";
import { outputSql } from "../src/output";
import { parseSql } from "../src/parse";

const schema = defineSchema({
  org: { id: null },
  user: { id: null, org_id: { ft: "org", fc: "id" } },
  message: { id: null, user_id: { ft: "user", fc: "id" } },
  key: { id: null, org_id: { ft: "org", fc: "id" } },
});

test("resolveGuardAliases returns guard with aliases for FK columns", () => {
  const guards: WhereGuard[] = [{ table: "org", column: "id", value: 1 }];

  const result = resolveGuardAliases(schema, guards).unwrap();

  expect(result).toEqual([
    {
      table: "org",
      column: "id",
      value: 1,
      aliases: [
        { table: "user", column: "org_id" },
        { table: "key", column: "org_id" },
      ],
    },
  ]);
});

const guards: WhereGuard[] = [{ table: "org", column: "id", value: 1 }];

test("resolveGuardJoins adds intermediate joins to reach guard table", () => {
  const ast = parseSql("SELECT * FROM message").unwrap();

  const result = insertNeededGuardJoins(ast, schema, guards, true).unwrap();
  const sql = outputSql(result);

  expect(sql).toBe(
    'SELECT * FROM "message" INNER JOIN "user" ON "user"."id" = "message"."user_id" INNER JOIN "org" ON "org"."id" = "user"."org_id"',
  );
});

test("resolveGuardJoins is a no-op when guard table already present", () => {
  const ast = parseSql("SELECT * FROM org").unwrap();

  const result = insertNeededGuardJoins(ast, schema, guards, true).unwrap();
  const sql = outputSql(result);

  expect(sql).toBe('SELECT * FROM "org"');
});

test("resolveGuardJoins adds single join for directly linked table", () => {
  const ast = parseSql("SELECT * FROM user").unwrap();

  const result = insertNeededGuardJoins(ast, schema, guards, true).unwrap();
  const sql = outputSql(result);

  expect(sql).toBe('SELECT * FROM "user" INNER JOIN "org" ON "org"."id" = "user"."org_id"');
});

test("resolveGuardJoins errors when no path exists", () => {
  const isolated = defineSchema({
    org: { id: null },
    other: { id: null },
  });
  const ast = parseSql("SELECT * FROM other").unwrap();

  const result = insertNeededGuardJoins(ast, isolated, guards, true);
  expect(result.ok).toBe(false);
});
