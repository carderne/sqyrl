# agent-sql

Sanitise agent-written SQL for multi-tenant DBs.

You provide a tenant ID, and the agent supplies the query.

Apparently this is how [Trigger.dev does it](https://x.com/mattaitken/status/2033928542975639785).
And [Cloudflare](https://x.com/thomas_ankcorn/status/2033931057133748330).

## How it works

agent-sql works by fully parsing the supplied SQL query into an AST and transforming it:

- **Only `SELECT`:** it's impossible to insert, drop or anything else.
- **Reduced subset:** CTEs, subqueries and other tricky things are rejected.
- **Limited functions:** passed through a (configurable) whitelist.
- **No DoS:** a default `LIMIT` is applied, but can be adjusted.
- **`WHERE` guards:** insert multiple tenant/ownership conditions to be inserted.
- **`JOIN`s added:** if needed to reach the guard tenant tables (save on tokens).
- **No sneaky joins:** no `join secrets on true`. We have your back.

I plan to support inserts, updates, CTEs, subqueries once I can convincingly make them safe.

## Quickstart

```bash
npm install agent-sql
```

```ts
import { agentSql } from "agent-sql";

const sql = agentSql("SELECT * FROM msg", "msg.tenant_id", 123);

console.log(sql);
// SELECT *
// FROM msg
// WHERE msg.tenant_id = 123
// LIMIT 10000
```

## Usage

### Define a schema

In the simple example above, all `JOIN`s will be blocked.
For agent-sql to know what joins and tables permit, you need to define a schema.
Heads up: if you use Drizzle, you can just [use your Drizzle schema](#integration-with-ai-sdk-and-drizzle).

```ts
import { createAgentSql, defineSchema } from "agent-sql";

// Define your schema.
// Only the tables listed will be permitted
// Joins can only use the FKs defined here
const schema = defineSchema({
  tenant: { id: null },
  msg: { tenant_id: { ft: "tenant", fc: "id" } },
});

// Use your schema from above
// Specify 1+ column->value pairs that will be enforced
const agentSql = createAgentSql(schema, { "tenant.id": 123 });

// Now use it
const sql = agentSql("SELECT * FROM msg");
```

Outputs:

```sql
SELECT
  msg.*                        -- qualify the *
FROM msg
INNER JOIN tenant              -- add the needed join for the guard
  ON tenant.id = msg.tenant_id -- use the schema to join correctly
WHERE tenant.id = 123          -- apply the guard
LIMIT 10000                    -- limit the rows
```

### Bad stuff is blocked

The following query will be blocked (many times over).

```sql
SELECT
    sneaky_func('./bad_file')      -- won't pass whitelist
FROM secret
JOIN random                        -- not an approved table
  ON random.id = secret.id         -- not an approved FK pair
JOIN danger                        -- disconnected from join graph
  ON true                          -- not allowed
WHERE true                         -- won't trick anyone
```

### Integration with AI SDK and Drizzle

If you're using Drizzle, you can skip the schema step and use the one you already have!

Just pass it through, and `agentSql` will respect your schema.

```ts
import { tool } from "ai";
import { sql } from "drizzle-orm";

import { createAgentSql } from "agent-sql";
import { defineSchemaFromDrizzle } from "agent-sql/drizzle";

import { db } from "@/db";
import * as drizzleSchema from "@/db/schema";

// No need to re-enter your schema, we'll pull it in from Drizzle
const schema = defineSchemaFromDrizzle(drizzleSchema);

function makeSqlTool(tenantId: string) {
  // Create a sanitiser function for this tenant
  // Specify one or more column->value pairs that will be enforced
  const agentSql = createAgentSql(schema, { "tenant.id": tenantId });

  return tool({
    description: "Run raw SQL against the DB",
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }) => {
      // The LLM can pass any query it likes, we'll sanitise it if possible
      // and return helpful error messages if not
      const sql = agentSql(query);
      // Now we can throw that straight at the db and be confident it'll only
      // return data from the specified tenant
      return db.execute(sql.raw(sql));
    },
  });
}
```

### If you don't want your whole Drizzle schema available

You can also exclude tables if you don't want agents to see them:

```ts
import { defineSchemaFromDrizzle } from "agent-sql/drizzle";

const schema = defineSchemaFromDrizzle(drizzleSchema, {
  exclude: ["api_keys"],
});
```

## Development

First install [Vite+](https://viteplus.dev/guide/):

```bash
curl -fsSL https://vite.plus | bash
```

Install dependencies:

```bash
vp install
```

Format, lint, typecheck:

```bash
vp check --fix
```

Run the unit tests:

```bash
vp test
```

Build the library:

```bash
vp pack
```
