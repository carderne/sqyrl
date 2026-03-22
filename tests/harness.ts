import { DatabaseSync } from "node:sqlite";

import { PGlite } from "@electric-sql/pglite";
import { expect } from "vite-plus/test";

import { defineSchema } from "../src";
import { SanitiseError } from "../src/errors";
import { Result } from "../src/result";

export const secret = "SECRET";

export interface Query {
  name: string;
  sql: string;
  // whether we expect the query to pass sanitisation
  expectPassSan: boolean;
}

export function dataIsSafe(object: unknown): boolean {
  return !JSON.stringify(object).includes(secret);
}

export const ddl: string[] = [
  // Common root tenant table
  `CREATE TABLE tenant (id INTEGER PRIMARY KEY)`,
  `INSERT INTO tenant (id) VALUES (1), (2)`,

  // Simple table for basic tests
  `CREATE TABLE "key" (
      id INTEGER PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenant(id)
    )`,

  `CREATE TABLE "user" (
      id INTEGER PRIMARY KEY,
      tenant_id INTEGER REFERENCES tenant(id)
    )`,

  `CREATE TABLE message (
      user_id INTEGER REFERENCES "user"(id),
      secret TEXT
    )`,

  `INSERT INTO "user" (id, tenant_id) VALUES (1, 1), (2, 2)`,
  `INSERT INTO message (user_id, secret) VALUES (1, 'hello'), (2, '${secret}')`,

  // Complex table setup
  //  Schema: A multi-tenant system with complex FK relationships including
  //  a diamond pattern that creates ambiguous tenant paths.
  //
  //  tenant (id)                  -- the guard table
  //  team (id, tenant_id FK)     -- belongs to a tenant
  //  project (id, team_id FK)    -- belongs to a team
  //  employee (id, tenant_id FK) -- belongs to a tenant
  //  document (id, project_id FK, author_id FK) -- TWO FKs: project AND author
  //  secret_note (id, document_id FK, content TEXT) -- the target data
  //  audit_log (id, employee_id FK, document_id FK) -- bridge table
  //
  //  Diamond: tenant -> team -> project -> document
  //           tenant -> employee -----------> document (via author_id)
  //
  //  KEY: document #3 has project_id from tenant 1 but author_id from tenant 2.
  //  This tests whether the FK path chosen affects tenant isolation.
  `CREATE TABLE team (id INTEGER PRIMARY KEY, tenant_id INTEGER REFERENCES tenant(id))`,
  `CREATE TABLE project (id INTEGER PRIMARY KEY, team_id INTEGER REFERENCES team(id))`,
  `CREATE TABLE employee (id INTEGER PRIMARY KEY, tenant_id INTEGER REFERENCES tenant(id))`,
  `CREATE TABLE document (
    id INTEGER PRIMARY KEY,
    project_id INTEGER REFERENCES project(id),
    author_id INTEGER REFERENCES employee(id)
  )`,
  `CREATE TABLE secret_note (
    id INTEGER PRIMARY KEY,
    document_id INTEGER REFERENCES document(id),
    content TEXT
  )`,
  `CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY,
    employee_id INTEGER REFERENCES employee(id),
    document_id INTEGER REFERENCES document(id)
  )`,

  // Insert
  `INSERT INTO team (id, tenant_id) VALUES (10, 1), (20, 2)`,
  `INSERT INTO project (id, team_id) VALUES (100, 10), (200, 20)`,
  `INSERT INTO employee (id, tenant_id) VALUES (1000, 1), (2000, 2)`,

  // Doc 1: fully tenant 1 (project 100 = tenant 1, author 1000 = tenant 1)
  // Doc 2: fully tenant 2 (project 200 = tenant 2, author 2000 = tenant 2)
  // Doc 3: CROSS-TENANT (project 100 = tenant 1, author 2000 = tenant 2)
  `INSERT INTO document (id, project_id, author_id) VALUES
    (1, 100, 1000),
    (2, 200, 2000),
    (3, 100, 2000)`,

  `INSERT INTO secret_note (id, document_id, content) VALUES
    (1, 1, 'safe-note'),
    (2, 2, 'XSECRETX'),
    (3, 3, 'CROSS-TENANT-NOTE')`,

  `INSERT INTO audit_log (id, employee_id, document_id) VALUES
    (1, 1000, 1),
    (2, 2000, 2),
    (3, 2000, 3)`,
];

export const schema = defineSchema({
  // common root tenant table
  tenant: { id: null },

  // simple part of the schema
  key: { id: null, tenant_id: { ft: "tenant", fc: "id" } },
  user: { id: null, tenant_id: { ft: "tenant", fc: "id" } },
  message: { user_id: { ft: "user", fc: "id" } },

  // complex part
  team: { id: null, tenant_id: { ft: "tenant", fc: "id" } },
  project: { id: null, team_id: { ft: "team", fc: "id" } },
  employee: { id: null, tenant_id: { ft: "tenant", fc: "id" } },
  document: {
    id: null,
    project_id: { ft: "project", fc: "id" },
    author_id: { ft: "employee", fc: "id" },
  },
  secret_note: { id: null, document_id: { ft: "document", fc: "id" }, content: null },
  audit_log: {
    id: null,
    employee_id: { ft: "employee", fc: "id" },
    document_id: { ft: "document", fc: "id" },
  },
});

export async function testOneAttack(
  query: Query,
  db: PGlite | DatabaseSync,
  sanitiser: (sql: string) => Result<string>,
) {
  const san = sanitiser(query.sql);

  if (!san.ok) {
    if (!(san.error instanceof SanitiseError)) {
      throw new Error("SQL parsing or something else failed", { cause: san.error });
    }
    expect(query.expectPassSan).toBe(false);
    return;
  }

  expect(query.expectPassSan).toBe(true);

  const result = db instanceof PGlite ? await db.query(san.data) : db.prepare(san.data).all();
  const safe = dataIsSafe(result);

  if (!safe) {
    console.error(`\n🚨 EXFILTRATION DETECTED in "${query.name}"!`);
    console.error(`Original SQL: ${query.sql}`);
    console.error(`Sanitised SQL: ${san.data}`);
    console.error(`Result: ${JSON.stringify(result, null, 2)}`);
  }

  expect(safe).toBe(true);
}
