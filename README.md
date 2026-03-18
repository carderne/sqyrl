# sqyrl

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/carderne/sqyrl@main/docs/logo.png" alt="sqyrl logo" width="200">
</p>

Sanitise agent-written SQL for multi-tenant DBs.

## Quickstart

```bash
npm install sqyrl
```

```ts
import { sqyrl } from "sqyrl";

const sql = sqyrl(`SELECT id, name FROM public.users WHERE status = 'active' LIMIT 10`, {
  schema: "public",
  table: "users",
  column: "tenant_id",
  value: "acme",
});

console.log(sql);
// SELECT id, name FROM public.users WHERE public.users.tenant_id = 'acme' AND status = 'active' LIMIT 10
```

`sqyrl` parses the SQL, enforces a mandatory equality filter on the given column as the outermost `AND` condition (so it cannot be short-circuited by agent-supplied `OR` clauses), and returns the sanitised SQL string.

## Ideas

- Inspiration: https://x.com/thomas_ankcorn/status/2033931057133748330
- Grammar ideas: https://github.com/iamwilhelm/ohm-grammar-sql

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
