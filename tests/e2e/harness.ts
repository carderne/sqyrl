import type { Client } from "pg";
import { expect } from "vite-plus/test";

import { defineSchema, createAgentSql } from "../../src";
import { SanitiseError } from "../../src/errors";
import { secret } from "./secret";

const schema = defineSchema({
  organization: { id: null },
  user: { id: null, organization_id: { ft: "organization", fc: "id" } },
  message: { user_id: { ft: "user", fc: "id" } },
});
const factory = createAgentSql({ column: "organization.id", schema, throws: false });
const agentSql = factory(1);

function dataIsSafe(object: unknown): boolean {
  return !JSON.stringify(object).includes(secret);
}

export interface Query {
  name: string;
  sql: string;
  // whether we expect the query to pass sanitisation
  expectPassSan: boolean;
}

export async function testOneAttack(query: Query, client: Client) {
  const san = agentSql(query.sql);

  if (!san.ok) {
    if (!(san.error instanceof SanitiseError)) {
      throw new Error("SQL parsing or something else failed", { cause: san.error });
    }
    expect(query.expectPassSan).toBe(false);
    return;
  }

  expect(query.expectPassSan).toBe(true);

  const result = await client.query(san.data);
  expect(dataIsSafe(result)).toBe(true);
}
