# sqyrl

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/carderne/sqyrl@main/docs/logo.png" alt="sqyrl logo" width="200">
</p>

Sanitise agent-written SQL for multi-tenant DBs.

You provide a tenant ID, and the agent supplies the query.

sqyrl works by fully parsing the supplied SQL query into an AST.
The grammar ONLY accepts `SELECT` statements. Anything else is an error.
CTEs and other complex things that we aren't confident of securing: error.

Then we ensure that that the needed tenant table is somewhere in the query,
and add a `WHERE` clause ensuring that only values from the supplied ID are returned.

Apparently this is how [Trigger.dev does it](https://x.com/mattaitken/status/2033928542975639785). And [Cloudflare](https://x.com/thomas_ankcorn/status/2033931057133748330).

## Quickstart

```bash
npm install sqyrl
```

```ts
import { sqyrl } from "sqyrl";

const sql = sqyrl(`SELECT id, name FROM users WHERE status = 'active' LIMIT 10`, {
  table: "users",
  col: "tenant_id",
  value: "acme",
});

console.log(sql);
// SELECT id, name
// FROM users
// WHERE (users.tenant_id = 'acme'
// AND status = 'active') LIMIT 10
```

Or, more usefully:

```ts
import { makeSqyrl } from "sqyrl";
import { tool } from "ai";
import { sql } from "drizzle-orm";
import { db } from "@/db";

function makeSqlTool(orgId: string) {
  // Create a sanitiser function for this tenant
  const sqyrl = makeSqyrl({ table: "org", col: "id", value: orgId });

  return tool({
    description: "Run raw SQL against the DB",
    inputSchema: z.object({ query: z.string() }),
    execute: async ({ query }) => {
      // The LLM can pass any query it likes, we'll sanitise it if possible
      // and return helpful error messages if not
      const sanitised = sqyrl(query);
      // Now we can throw that straight at the db and be confident it'll only
      // return data from the specified tenant
      return db.execute(sql.raw(sanitised));
    },
  });
}
```

`sqyrl` parses the SQL, enforces a mandatory equality filter on the given column as the outermost `AND` condition (so it cannot be short-circuited by agent-supplied `OR` clauses), and returns the sanitised SQL string.

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
