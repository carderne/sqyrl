import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, test } from "vite-plus/test";

import { setupDb, teardownDb } from "./db";
import { Query, testOneAttack } from "./harness";

const queries: Query[] = [
  {
    name: "join-on-true",
    sql: `
    select *
    from organization
    right join "message" on true
    `,
    expectPassSan: false,
  },
  {
    name: "select-orgs",
    sql: `
    select *
    from organization
    `,
    expectPassSan: true,
  },
  {
    name: "join-follows-joins",
    sql: `
    select *
    from organization
    join "user" on organization.id = "user".organization_id
    join message on message.user_id = user.id
    `,
    expectPassSan: true,
  },
  {
    name: "join-doesnot-follow-joins",
    sql: `
    select *
    from message
    join user on user.id = message.user_id
    join organization on organization.id = user.organization_id
    `,
    expectPassSan: true,
  },
  {
    name: "table-alias-bypass",
    sql: `
    select * from organization as o
    join "user" on "user".organization_id = organization.id
    join message on message.user_id = "user".id
    `,
    expectPassSan: false,
  },
  {
    name: "right-join-leak",
    sql: `
    select message.secret from organization
    right join "user" on organization.id = "user".organization_id
    right join message on message.user_id = "user".id
    `,
    expectPassSan: true,
  },
  {
    name: "where-or-bypass",
    sql: `
    select message.secret from organization
    join "user" on organization.id = "user".organization_id
    join message on message.user_id = "user".id
    where organization.id = 2 or true
    `,
    expectPassSan: true,
  },
  {
    name: "cross-join-leak",
    sql: `
    select message.secret from organization
    cross join message
    `,
    expectPassSan: false,
  },
  {
    name: "natural-join-leak",
    sql: `
    select message.secret from organization
    natural join message
    `,
    expectPassSan: false,
  },
  {
    name: "direct-message-no-org",
    sql: `
    select * from message
    `,
    expectPassSan: false,
  },
  {
    name: "using-join-bypass",
    sql: `
    select secret from organization
    join "user" on organization.id = "user".organization_id
    join message using (user_id)
    `,
    expectPassSan: false,
  },
  {
    name: "unqualified-join-cols",
    sql: `
    select message.secret from organization
    join "user" on id = organization_id
    join message on user_id = id
    `,
    expectPassSan: false,
  },
  {
    name: "skip-fk-chain-direct-join",
    sql: `
    select message.secret from organization
    join message on message.user_id = organization.id
    `,
    expectPassSan: false,
  },
  {
    name: "full-outer-join",
    sql: `
    select message.secret from organization
    full outer join "user" on organization.id = "user".organization_id
    full outer join message on message.user_id = "user".id
    `,
    expectPassSan: true,
  },
  {
    name: "quoted-func-name-injection",
    sql: `
    select "id::text from organization union select secret from message--"(1)
    from organization
    `,
    expectPassSan: false,
  },
  {
    name: "qualified-wildcard-quoted",
    sql: `
    select "organization".* from organization
    `,
    expectPassSan: true,
  },
  {
    name: "alias-injection",
    sql: `
    select 'x' as "x from organization union select secret from message--" from organization
    `,
    expectPassSan: false,
  },
  {
    name: "group-by-secret",
    sql: `
    select count(*) from organization
    join "user" on organization.id = "user".organization_id
    join message on message.user_id = "user".id
    group by message.secret
    having count(*) > 0
    `,
    expectPassSan: true,
  },
  {
    name: "order-by-case-probe",
    sql: `
    select organization.id from organization
    join "user" on organization.id = "user".organization_id
    join message on message.user_id = "user".id
    order by case when message.secret = 'test' then 1 else 2 end
    `,
    expectPassSan: true,
  },
  {
    name: "system-table-pg-class",
    sql: `
    select * from pg_class
    `,
    expectPassSan: false,
  },
  {
    name: "system-table-info-schema",
    sql: `
    select * from information_schema.tables
    `,
    expectPassSan: false,
  },
  {
    name: "ilike-wildcard-probe",
    sql: `
    select message.secret from organization
    join "user" on organization.id = "user".organization_id
    join message on message.user_id = "user".id
    where message.secret ilike '%'
    `,
    expectPassSan: true,
  },
  {
    name: "cast-shorthand-guard-bypass",
    sql: `
    select message.secret from organization
    join "user" on organization.id = "user".organization_id
    join message on message.user_id = "user".id
    where organization.id::text = '2'
    `,
    expectPassSan: true,
  },
  {
    name: "distinct-on-secret",
    sql: `
    select distinct on (message.secret) message.secret from organization
    join "user" on organization.id = "user".organization_id
    join message on message.user_id = "user".id
    order by message.secret
    `,
    expectPassSan: true,
  },
  {
    name: "cast-shorthand-or-bypass",
    sql: `
    select message.secret from organization
    join "user" on organization.id = "user".organization_id
    join message on message.user_id = "user".id
    where organization.id::text = '1' or organization.id::text = '2'
    `,
    expectPassSan: true,
  },
  {
    name: "where-target-other-org-user",
    sql: `
    select message.secret from organization
    join "user" on organization.id = "user".organization_id
    join message on message.user_id = "user".id
    where message.user_id = 2
    `,
    expectPassSan: true,
  },
  {
    name: "having-ilike-secret-probe",
    sql: `
    select case when count(*) > 0 then 'yes' else 'no' end from organization
    join "user" on organization.id = "user".organization_id
    join message on message.user_id = "user".id
    group by message.secret
    having message.secret ilike '%secret%'
    `,
    expectPassSan: true,
  },
];

const singleQuery: Query = {
  name: "new-attack",
  sql: `select * from organization`,
  expectPassSan: true,
};

describe("e2e", () => {
  let client: PGlite;

  beforeAll(async () => {
    client = await setupDb();
  });

  afterAll(async () => {
    await teardownDb();
  });

  for (const query of queries) {
    test(query.name, async () => {
      await testOneAttack(query, client as any);
    });
  }

  test("new-attack", async () => {
    await testOneAttack(singleQuery, client as any);
  });
});
