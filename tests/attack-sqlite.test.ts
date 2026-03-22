import { DatabaseSync } from "node:sqlite";

import { afterAll, beforeAll, describe, test } from "vite-plus/test";

import { createAgentSql } from "../src";
import { ddl, Query, schema, testOneAttack } from "./harness";

const queries: Query[] = [
  {
    name: "sqlite-master",
    sql: `
    select * from sqlite_master
    `,
    expectPassSan: false,
  },
  {
    name: "sqlite-schema",
    sql: `
    select * from sqlite_schema
    `,
    expectPassSan: false,
  },
  {
    name: "load-extension-select",
    sql: `
    select load_extension('/tmp/evil.so')
    from tenant
    `,
    expectPassSan: false,
  },
  {
    name: "load-extension-where",
    sql: `
    select * from tenant
    where load_extension('/tmp/evil.so') is not null
    `,
    expectPassSan: false,
  },
  {
    name: "load-extension-with-entrypoint",
    sql: `
    select load_extension('/tmp/evil.so', 'sqlite3_evil_init')
    from tenant
    `,
    expectPassSan: false,
  },
  {
    name: "readfile",
    sql: `
    select readfile('/etc/passwd')
    from tenant
    `,
    expectPassSan: false,
  },
  {
    name: "writefile-exfil",
    sql: `
    select writefile('/tmp/exfil.txt', secret)
    from tenant
    join "user" on tenant.id = "user".tenant_id
    join message on message.user_id = "user".id
    `,
    expectPassSan: false,
  },
  {
    name: "hex-obfuscation",
    sql: `
    select hex(message.secret) from tenant
    join "user" on tenant.id = "user".tenant_id
    join message on message.user_id = "user".id
    `,
    expectPassSan: true,
  },
  {
    name: "unicode-substr-probe",
    sql: `
    select unicode(substr(message.secret, 1, 1)) from tenant
    join "user" on tenant.id = "user".tenant_id
    join message on message.user_id = "user".id
    `,
    expectPassSan: true,
  },
  {
    name: "replace-transform",
    sql: `
    select replace(message.secret, 'S', 's') from tenant
    join "user" on tenant.id = "user".tenant_id
    join message on message.user_id = "user".id
    `,
    expectPassSan: true,
  },
  {
    name: "length-probe",
    sql: `
    select length(message.secret) from tenant
    join "user" on tenant.id = "user".tenant_id
    join message on message.user_id = "user".id
    `,
    expectPassSan: true,
  },
  {
    name: "typeof-fingerprint",
    sql: `
    select typeof(message.secret) from tenant
    join "user" on tenant.id = "user".tenant_id
    join message on message.user_id = "user".id
    `,
    expectPassSan: true,
  },
  {
    name: "unconnected-table",
    sql: `
    select *
    from message
    join key on key.tenant_id = tenant.id
    join tenant on key.tenant_id = tenant.id
    where tenant.id = 1
    `,
    expectPassSan: false,
  },
  {
    name: "unconnected-groups",
    sql: `
    select *
    from message
    join user on user.id = message.user_id
    join tenant on tenant.id = key.tenant_id
    join key on key.tenant_id = tenant.id
    where tenant.id = 1
    `,
    expectPassSan: false,
  },
  {
    name: "connected-groups",
    sql: `
    select *
    from message
    join user on user.id = message.user_id
    join tenant on tenant.id = user.tenant_id
    join key on key.tenant_id = tenant.id
    where tenant.id = 1
    `,
    expectPassSan: true,
  },
];

const singleQuery: Query = {
  name: "new-attack",
  sql: `select * from tenant`,
  expectPassSan: true,
};

describe("attack-pglite", () => {
  let db: DatabaseSync;
  const agentSql = createAgentSql(schema, { "tenant.id": 1 }, { throws: false, db: "sqlite" });

  beforeAll(() => {
    db = new DatabaseSync(":memory:");

    for (const query of ddl) {
      db.exec(query);
    }
  });

  afterAll(() => {
    db.close();
  });

  for (const query of queries) {
    test(query.name, async () => {
      await testOneAttack(query, db, agentSql);
    });
  }

  test("new-attack", async () => {
    await testOneAttack(singleQuery, db, agentSql);
  });
});
