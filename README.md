# agent-sql

Sanitise agent-written SQL for multi-tenant DBs.

You provide a tenant ID, and the agent supplies the query.

agent-sql works by fully parsing the supplied SQL query into an AST.
The grammar ONLY accepts `SELECT` statements. Anything else is an error.
CTEs and other complex things that we aren't confident of securing: error.

It ensures that that the needed tenant table is somewhere in the query,
and adds a `WHERE` clause ensuring that only values from the supplied ID are returned.
Then it checks that the tables and `JOIN`s follow the schema, preventing sneaky joins.

Finally, we throw in a `LIMIT` clause (configurable) to prevent accidental LLM denial-of-service.

Apparently this is how [Trigger.dev does it](https://x.com/mattaitken/status/2033928542975639785).
And [Cloudflare](https://x.com/thomas_ankcorn/status/2033931057133748330).

## Quickstart

```bash
npm install agent-sql
```

```ts
import { agentSql } from "agent-sql";

const sql = agentSql(`SELECT * FROM msg`, "msg.user_id", 123);

console.log(sql);
// SELECT *
// FROM msg
// WHERE msg.user_id = 123
// LIMIT 10000
```

`agent-sql` parses the SQL, enforces a mandatory equality filter on the given column as the outermost `AND` condition (so it cannot be short-circuited by agent-supplied `OR` clauses), and returns the sanitised SQL string.

## Usage

### Define once, use many times

The simple approach above is enough to get started.
But since no schema is provided, `JOIN`s will be blocked.
A schema can be passed to `agentSql`, but typically you'll want to set it up once and re-use.

```ts
import { createAgentSql, defineSchema } from "agent-sql";
import { tool } from "ai";
import { sql } from "drizzle-orm";
import { db } from "@/db";

// Define your schema.
// Only the tables listed will be permitted
// Joins can only use the FKs defined here
const schema = defineSchema({
  user: { id },
  msg: { userId: { user: "id" } },
});

function makeSqlTool(userId: string) {
  // Create a sanitiser function for this tenant
  const agentSql = createAgentSql({
    column: "user.id",
    value: userId,
    schema,
  });

  return tool({
    description: "Run raw SQL against the DB",
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }) => {
      // The LLM can pass any query it likes, we'll sanitise it if possible
      // and return helpful error messages if not
      const sanitised = agentSql(query);
      // Now we can throw that straight at the db and be confident it'll only
      // return data from the specified tenant
      return db.execute(sql.raw(sanitised));
    },
  });
}
```

### It works with Drizzle

If you're using Drizzle, you can skip the schema step and use the one you already have!

Just pass it through, and `agentSql` will respect your schema.

```ts
import { defineSchemaFromDrizzle } from "agent-sql/drizzle";
import * as drizzleSchema from "@/db/schema";

const schema = defineSchemaFromDrizzle(drizzleSchema);

// The rest as before...
const agentSql = createAgentSql({
  column: "user.id",
  value: userId,
  schema,
});
```

You can also exclude tables if you don't want agents to see them:

```ts
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
