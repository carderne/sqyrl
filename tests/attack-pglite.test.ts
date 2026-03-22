import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, test } from "vite-plus/test";

import { createAgentSql } from "../src";
import { testOneAttack, Query, schema, ddl } from "./harness";

const simpleSchemaQueries: Query[] = [
  {
    name: "join-on-true",
    sql: `
    select *
    from tenant
    right join "message" on true
    `,
    expectPassSan: false,
  },
  {
    name: "select-tenants",
    sql: `
    select *
    from tenant
    `,
    expectPassSan: true,
  },
  {
    name: "join-follows-joins",
    sql: `
    select *
    from tenant
    join "user" on tenant.id = "user".tenant_id
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
    join tenant on tenant.id = user.tenant_id
    `,
    expectPassSan: true,
  },
  {
    name: "table-alias-bypass",
    sql: `
    select * from tenant as o
    join "user" on "user".tenant_id = tenant.id
    join message on message.user_id = "user".id
    `,
    expectPassSan: false,
  },
  {
    name: "right-join-leak",
    sql: `
    select message.secret from tenant
    right join "user" on tenant.id = "user".tenant_id
    right join message on message.user_id = "user".id
    `,
    expectPassSan: true,
  },
  {
    name: "where-or-bypass",
    sql: `
    select message.secret from tenant
    join "user" on tenant.id = "user".tenant_id
    join message on message.user_id = "user".id
    where tenant.id = 2 or true
    `,
    expectPassSan: true,
  },
  {
    name: "cross-join-leak",
    sql: `
    select message.secret from tenant
    cross join message
    `,
    expectPassSan: false,
  },
  {
    name: "natural-join-leak",
    sql: `
    select message.secret from tenant
    natural join message
    `,
    expectPassSan: false,
  },
  {
    name: "direct-message-no-tenant",
    sql: `
    select * from message
    `,
    expectPassSan: true,
  },
  {
    name: "using-join-bypass",
    sql: `
    select secret from tenant
    join "user" on tenant.id = "user".tenant_id
    join message using (user_id)
    `,
    expectPassSan: false,
  },
  {
    name: "unqualified-join-cols",
    sql: `
    select message.secret from tenant
    join "user" on id = tenant_id
    join message on user_id = id
    `,
    expectPassSan: false,
  },
  {
    name: "skip-fk-chain-direct-join",
    sql: `
    select message.secret from tenant
    join message on message.user_id = tenant.id
    `,
    expectPassSan: false,
  },
  {
    name: "full-outer-join",
    sql: `
    select message.secret from tenant
    full outer join "user" on tenant.id = "user".tenant_id
    full outer join message on message.user_id = "user".id
    `,
    expectPassSan: true,
  },
  {
    name: "quoted-func-name-injection",
    sql: `
    select "id::text from tenant union select secret from message--"(1)
    from tenant
    `,
    expectPassSan: false,
  },
  {
    name: "qualified-wildcard-quoted",
    sql: `
    select "tenant".* from tenant
    `,
    expectPassSan: true,
  },
  {
    name: "alias-injection",
    sql: `
    select 'x' as "x from tenant union select secret from message--" from tenant
    `,
    expectPassSan: false,
  },
  {
    name: "group-by-secret",
    sql: `
    select count(*) from tenant
    join "user" on tenant.id = "user".tenant_id
    join message on message.user_id = "user".id
    group by message.secret
    having count(*) > 0
    `,
    expectPassSan: true,
  },
  {
    name: "order-by-case-probe",
    sql: `
    select tenant.id from tenant
    join "user" on tenant.id = "user".tenant_id
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
    select message.secret from tenant
    join "user" on tenant.id = "user".tenant_id
    join message on message.user_id = "user".id
    where message.secret ilike '%'
    `,
    expectPassSan: true,
  },
  {
    name: "cast-shorthand-guard-bypass",
    sql: `
    select message.secret from tenant
    join "user" on tenant.id = "user".tenant_id
    join message on message.user_id = "user".id
    where tenant.id::text = '2'
    `,
    expectPassSan: true,
  },
  {
    name: "distinct-on-secret",
    sql: `
    select distinct on (message.secret) message.secret from tenant
    join "user" on tenant.id = "user".tenant_id
    join message on message.user_id = "user".id
    order by message.secret
    `,
    expectPassSan: true,
  },
  {
    name: "cast-shorthand-or-bypass",
    sql: `
    select message.secret from tenant
    join "user" on tenant.id = "user".tenant_id
    join message on message.user_id = "user".id
    where tenant.id::text = '1' or tenant.id::text = '2'
    `,
    expectPassSan: true,
  },
  {
    name: "where-target-other-tenant-user",
    sql: `
    select message.secret from tenant
    join "user" on tenant.id = "user".tenant_id
    join message on message.user_id = "user".id
    where message.user_id = 2
    `,
    expectPassSan: true,
  },
  {
    name: "having-ilike-secret-probe",
    sql: `
    select case when count(*) > 0 then 'yes' else 'no' end from tenant
    join "user" on tenant.id = "user".tenant_id
    join message on message.user_id = "user".id
    group by message.secret
    having message.secret ilike '%secret%'
    `,
    expectPassSan: true,
  },
];

const complexSchemaQueries: Query[] = [
  // =============================================
  // BASELINE: valid queries that should work
  // =============================================
  {
    name: "baseline-select-tenant",
    sql: `select * from tenant`,
    expectPassSan: true,
  },
  {
    name: "baseline-join-through-project-chain",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
    `,
    expectPassSan: true,
  },
  {
    name: "baseline-join-through-employee-chain",
    sql: `
      select secret_note.content from tenant
      join employee on employee.tenant_id = tenant.id
      join document on document.author_id = employee.id
      join secret_note on secret_note.document_id = document.id
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: RIGHT JOIN chain to include non-matching rows
  // =============================================
  {
    name: "right-join-chain-bypass",
    sql: `
      select secret_note.content from tenant
      right join team on team.tenant_id = tenant.id
      right join project on project.team_id = team.id
      right join document on document.project_id = project.id
      right join secret_note on secret_note.document_id = document.id
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: FULL OUTER JOIN to include unmatched rows
  // =============================================
  {
    name: "full-outer-join-chain-bypass",
    sql: `
      select secret_note.content from tenant
      full outer join team on team.tenant_id = tenant.id
      full outer join project on project.team_id = team.id
      full outer join document on document.project_id = project.id
      full outer join secret_note on secret_note.document_id = document.id
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Auto-join from leaf table
  // The auto-joiner picks a path through the FK graph.
  // Which path does it pick for secret_note -> ... -> tenant?
  // =============================================
  {
    name: "auto-join-from-leaf",
    sql: `select content from secret_note`,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Diamond join - join document via employee path only
  // This path goes: tenant -> employee -> document -> secret_note
  // A document with project_id in tenant 1 but author_id in tenant 2
  // would be visible via the project path but NOT the employee path
  // =============================================
  {
    name: "diamond-via-employee-path",
    sql: `
      select secret_note.content from tenant
      join employee on employee.tenant_id = tenant.id
      join document on document.author_id = employee.id
      join secret_note on secret_note.document_id = document.id
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Diamond join via project path
  // Documents authored by tenant 2 employees but in tenant 1 projects
  // would show up here
  // =============================================
  {
    name: "diamond-via-project-path",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Cross join attempt (should be blocked)
  // =============================================
  {
    name: "cross-join-secret-note",
    sql: `
      select secret_note.content from tenant
      cross join secret_note
    `,
    expectPassSan: false,
  },

  // =============================================
  // ATTACK: Natural join (should be blocked)
  // =============================================
  {
    name: "natural-join-secret",
    sql: `
      select * from tenant
      natural join secret_note
    `,
    expectPassSan: false,
  },

  // =============================================
  // ATTACK: Self-referencing ON clause
  // The ON only references the join table, creating a self-loop
  // =============================================
  {
    name: "self-ref-on-clause",
    sql: `
      select secret_note.content from tenant
      join secret_note on secret_note.id = secret_note.document_id
    `,
    expectPassSan: false,
  },

  // =============================================
  // ATTACK: Skip intermediate table (use wrong FK)
  // =============================================
  {
    name: "skip-intermediate-join",
    sql: `
      select secret_note.content from tenant
      join document on document.id = tenant.id
      join secret_note on secret_note.document_id = document.id
    `,
    expectPassSan: false,
  },

  // =============================================
  // ATTACK: Use USING clause (should be blocked)
  // =============================================
  {
    name: "using-clause",
    sql: `
      select * from document
      join secret_note using (document_id)
    `,
    expectPassSan: false,
  },

  // =============================================
  // ATTACK: Table alias (should be blocked)
  // =============================================
  {
    name: "table-alias",
    sql: `select t.id from tenant as t`,
    expectPassSan: false,
  },

  // =============================================
  // ATTACK: Unqualified columns in ON (should be blocked)
  // =============================================
  {
    name: "unqualified-on-columns",
    sql: `
      select * from tenant
      join team on tenant_id = id
    `,
    expectPassSan: false,
  },

  // =============================================
  // ATTACK: WHERE with OR TRUE to bypass guard
  // Guard is AND'd first, but user's OR TRUE is inside the user's WHERE
  // =============================================
  {
    name: "where-or-true-bypass",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      where tenant.id = 2 or true
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: System table access
  // =============================================
  {
    name: "pg-class-access",
    sql: `select * from pg_class`,
    expectPassSan: false,
  },
  {
    name: "info-schema-access",
    sql: `select * from information_schema.tables`,
    expectPassSan: false,
  },

  // =============================================
  // ATTACK: GROUP BY + HAVING to probe secret content
  // =============================================
  {
    name: "group-by-secret-probe",
    sql: `
      select count(*) from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      group by secret_note.content
      having secret_note.content like 'X%'
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: ORDER BY CASE to probe data via side channel
  // =============================================
  {
    name: "order-by-case-probe",
    sql: `
      select tenant.id from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      order by case when secret_note.content = 'XSECRETX' then 1 else 2 end
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: DISTINCT ON secret column
  // =============================================
  {
    name: "distinct-on-secret",
    sql: `
      select distinct on (secret_note.content) secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      order by secret_note.content
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Join via audit_log bridge table
  // audit_log connects employee and document
  // =============================================
  {
    name: "audit-log-bridge",
    sql: `
      select secret_note.content from tenant
      join employee on employee.tenant_id = tenant.id
      join audit_log on audit_log.employee_id = employee.id
      join document on audit_log.document_id = document.id
      join secret_note on secret_note.document_id = document.id
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Mix both FK paths (project + employee) for document
  // Both paths go through tenant, but document #3 has cross-tenant FKs
  // =============================================
  {
    name: "mixed-path-both-fks",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join employee on employee.tenant_id = tenant.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: LEFT JOIN with IS NULL to find orphaned rows
  // =============================================
  {
    name: "left-join-null-trick",
    sql: `
      select secret_note.content from secret_note
      left join document on document.id = secret_note.document_id
      left join project on project.id = document.project_id
      left join team on team.id = project.team_id
      left join tenant on tenant.id = team.tenant_id
      where tenant.id is null
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Wrong FK column (document.id = project.id instead of proper FK)
  // =============================================
  {
    name: "wrong-fk-column",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.id = project.id
      join secret_note on secret_note.document_id = document.id
    `,
    expectPassSan: false,
  },

  // =============================================
  // ATTACK: generate_series to create fake tenant rows
  // Should fail parse (generate_series returns rows, not supported in FROM)
  // =============================================
  {
    name: "generate-series-in-select",
    sql: `
      select generate_series(1, 10) from tenant
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: CAST to bypass type checking on guard
  // =============================================
  {
    name: "cast-guard-bypass",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      where tenant.id::text = '2'
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: string_agg to aggregate cross-row data
  // =============================================
  {
    name: "string-agg-aggregate",
    sql: `
      select string_agg(secret_note.content, ',') from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: COALESCE with literal fallback
  // =============================================
  {
    name: "coalesce-fallback",
    sql: `
      select coalesce(secret_note.content, 'fallback') from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Duplicate same table in multiple joins
  // (same table referenced twice)
  // =============================================
  {
    name: "duplicate-table-join",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      join employee on employee.tenant_id = tenant.id
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Quoted identifier for system table
  // =============================================
  {
    name: "quoted-system-table",
    sql: `select * from "pg_class"`,
    expectPassSan: false,
  },

  // =============================================
  // ATTACK: Comment to hide part of query
  // The parser should handle comments correctly
  // =============================================
  {
    name: "comment-hiding",
    sql: `
      select * from tenant -- this is safe
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Block comment to hide code
  // =============================================
  {
    name: "block-comment-hiding",
    sql: `
      select * from tenant /* union select * from secret_note */
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Reversed FK column order in ON clause
  // Instead of team.tenant_id = tenant.id, use tenant.id = team.tenant_id
  // =============================================
  {
    name: "reversed-fk-order",
    sql: `
      select secret_note.content from tenant
      join team on tenant.id = team.tenant_id
      join project on team.id = project.team_id
      join document on project.id = document.project_id
      join secret_note on document.id = secret_note.document_id
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: WHERE with subexpression targeting other tenant
  // Guard is AND'd, so tenant.id = 1 AND (tenant.id = 2 OR ...)
  // should be empty
  // =============================================
  {
    name: "where-target-other-tenant",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      where tenant.id = 2
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Negation of guard via WHERE NOT
  // =============================================
  {
    name: "where-not-guard",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      where not (tenant.id = 1)
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Use IN clause to target multiple tenants
  // =============================================
  {
    name: "where-in-multiple-tenants",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      where tenant.id in (1, 2)
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Use BETWEEN to target multiple tenants
  // =============================================
  {
    name: "where-between-tenants",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      where tenant.id between 1 and 2
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: LIMIT 0 OFFSET trick
  // The system enforces max LIMIT but what about weird OFFSET values?
  // =============================================
  {
    name: "offset-trick",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      offset 999999
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: pg_typeof to fingerprint columns
  // =============================================
  {
    name: "pg-typeof-probe",
    sql: `
      select pg_typeof(secret_note.content) from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Use encode() to transform secret data
  // =============================================
  {
    name: "encode-transform",
    sql: `
      select encode(secret_note.content::bytea, 'base64') from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: WHERE clause with bare TRUE to bypass guard logic
  // Tests if guard AND (true) still works correctly
  // =============================================
  {
    name: "where-bare-true",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      where true
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Negative values as guard bypass attempts
  // =============================================
  {
    name: "where-negative-comparison",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      where tenant.id > -1
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: CASE expression in WHERE to conditionally bypass
  // =============================================
  {
    name: "case-in-where-bypass",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      where case when 1=1 then true else false end
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Empty string comparison for guard column
  // =============================================
  {
    name: "guard-empty-string-compare",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      where tenant.id != 1
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Multiple joins to same table (different FK paths)
  // This is interesting because checkJoinColumns iterates over
  // ast.joins - what happens when the SAME table appears twice?
  // The duplicate table set in connectivity check might mask issues
  // =============================================
  {
    name: "same-table-two-fk-paths",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join employee on employee.tenant_id = tenant.id
      join secret_note on secret_note.document_id = document.id
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Session info functions
  // These are allowed but shouldn't leak tenant data
  // (current_user is a keyword, not a function, so it parses as identifier)
  // =============================================
  {
    name: "session-info-probe",
    sql: `
      select current_database(), version() from tenant
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Arithmetic in WHERE to compute guard value
  // WHERE tenant.id = (2 - 1) should match tenant 1
  // WHERE tenant.id = (1 + 1) should be filtered by guard
  // =============================================
  {
    name: "arithmetic-guard-evasion",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      where tenant.id = (1 + 1)
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: LIKE with wildcards on guard column
  // =============================================
  {
    name: "like-wildcard-guard",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      where tenant.id::text like '%'
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: NULL comparison to bypass guard
  // WHERE tenant.id IS NOT NULL (always true for existing rows)
  // =============================================
  {
    name: "is-not-null-bypass",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      where tenant.id is not null
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Wildcard * with auto-join leaking extra columns
  // When auto-join adds tables, are their columns hidden?
  // =============================================
  {
    name: "wildcard-auto-join-columns",
    sql: `select * from secret_note`,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Very deep nested parentheses in WHERE
  // Could this overflow or bypass parsing?
  // =============================================
  {
    name: "deep-nested-where",
    sql: `
      select tenant.id from tenant
      where (((((((((tenant.id = 1)))))))))
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Multiple OR conditions targeting all tenants
  // =============================================
  {
    name: "or-chain-all-tenants",
    sql: `
      select secret_note.content from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
      where tenant.id = 1 or tenant.id = 2 or tenant.id = 3
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: Use GREATEST/LEAST to manipulate values
  // =============================================
  {
    name: "greatest-manipulation",
    sql: `
      select greatest(secret_note.id, 0) from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
    `,
    expectPassSan: true,
  },

  // =============================================
  // ATTACK: count(*) without any data column
  // Can reveal number of records across tenants
  // =============================================
  {
    name: "count-all-records",
    sql: `
      select count(*) from tenant
      join team on team.tenant_id = tenant.id
      join project on project.team_id = team.id
      join document on document.project_id = project.id
      join secret_note on secret_note.document_id = document.id
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
  let db: PGlite;
  const agentSql = createAgentSql(schema, { "tenant.id": 1 }, { throws: false, db: "pglite" });

  beforeAll(async () => {
    db = new PGlite();
    for (const query of ddl) {
      await db.query(query);
    }
  });

  afterAll(async () => {
    await db.close();
  });

  for (const query of simpleSchemaQueries) {
    test(query.name, async () => {
      await testOneAttack(query, db, agentSql);
    });
  }

  for (const query of complexSchemaQueries) {
    test(query.name, async () => {
      await testOneAttack(query, db, agentSql);
    });
  }

  test("new-attack", async () => {
    await testOneAttack(singleQuery, db, agentSql);
  });
});
