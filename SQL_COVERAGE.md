# SQL Coverage

Tracking SQL feature coverage in `src/sql.ohm` / `src/ast.ts`.

---

## Top-Level Statement Types

- [x] `SELECT`

---

## SELECT Clauses

- [x] `SELECT <columns>`
- [x] `FROM <table>`
- [x] `WHERE`
- [x] `LIMIT`
- [x] `DISTINCT`
- [x] `JOIN` (see JOIN section below)
- [x] `GROUP BY`
- [x] `HAVING`
- [x] `ORDER BY` (including `ASC` / `DESC` / `NULLS FIRST` / `NULLS LAST`)
- [x] `OFFSET`
- [ ] `FETCH FIRST n ROWS ONLY`
- [ ] `FOR UPDATE / FOR SHARE` (row-level locking)
- [ ] Set operations: `UNION`, `UNION ALL`, `INTERSECT`, `EXCEPT`
- [ ] `WITH` / CTE (`WITH name AS (…) SELECT …`)
- [ ] `WITH RECURSIVE`

---

## Column Expressions

- [x] `*` (wildcard)
- [x] `table.*` (qualified wildcard)
- [x] `table.column` (qualified name)
- [x] `column` (simple identifier)
- [x] Column alias (`AS`)
- [x] Expressions / arithmetic: `a + b`, `a - b`, `a * b`, `a / b`, `a % b`
- [x] Unary minus: `-expr`
- [x] String concatenation: `a || b`
- [x] Function calls: `count(*)`, `coalesce(a, b)`, `now()`, `lower(col)`, …
- [x] Aggregate functions: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`
- [x] `DISTINCT` inside aggregates: `COUNT(DISTINCT col)`
- [ ] Window functions: `ROW_NUMBER() OVER (…)`, `RANK()`, `LAG()`, …
- [ ] `OVER (PARTITION BY … ORDER BY … ROWS/RANGE …)`
- [x] `CASE WHEN … THEN … ELSE … END`
- [x] `CAST(expr AS type)`
- [ ] Subquery in SELECT list (scalar subquery)
- [ ] Row constructor: `ROW(a, b, c)`
- [ ] Type literals: `INTERVAL '1 day'`, `DATE '2024-01-01'`, …

---

## Literals & Types

- [x] String literals (`'…'`)
- [x] Integer literals
- [x] Float / decimal literals (`3.14`, `1e5`)
- [x] Boolean literals (`TRUE` / `FALSE`)
- [x] `NULL`
- [x] Unary minus on numeric (`-1`, `-expr`) — `+1` not supported

---

## FROM Clause

- [x] Simple table reference
- [x] Schema-qualified table (`schema.table`)
- [x] Table alias (`AS` and implicit)
- [ ] Multiple tables (comma-separated, implicit cross join)
- [ ] Subquery in FROM: `(SELECT …) AS alias`
- [ ] Lateral subquery: `LATERAL (…) AS alias`
- [ ] `TABLESAMPLE`
- [ ] `VALUES (…), (…)` as a table
- [ ] Table functions

---

## JOIN Types

- [x] `[INNER] JOIN … ON …`
- [x] `LEFT [OUTER] JOIN … ON …`
- [x] `RIGHT [OUTER] JOIN … ON …`
- [x] `FULL [OUTER] JOIN … ON …`
- [x] `CROSS JOIN`
- [x] `NATURAL JOIN`
- [x] `JOIN … USING (col, …)`
- [x] Multiple sequential joins
- [x] Self-join

---

## WHERE / Filter Expressions

- [x] Equality: `col = 'value'`
- [x] `AND`
- [x] `OR`
- [x] Parenthesised grouping
- [x] `NOT`
- [x] Inequality: `<>`, `!=`
- [x] Comparison: `<`, `>`, `<=`, `>=`
- [x] `IS NULL` / `IS NOT NULL`
- [x] `IS TRUE` / `IS FALSE` / `IS UNKNOWN`
- [x] `BETWEEN … AND …` / `NOT BETWEEN`
- [x] `IN (…)` list / `NOT IN (…)`
- [ ] `IN (subquery)` / `NOT IN (subquery)`
- [x] `LIKE` / `NOT LIKE`
- [ ] `SIMILAR TO`
- [ ] `EXISTS (subquery)`
- [ ] `ANY` / `ALL` / `SOME` (subquery comparisons)
- [ ] `DISTINCT FROM` / `NOT DISTINCT FROM`
- [x] Arithmetic expressions on either side of comparisons
- [x] Function calls in comparisons
- [x] Right-hand side column reference (col = col)
- [x] Right-hand side integer / boolean / NULL literals

---

## Subqueries

- [ ] Scalar subquery in WHERE (`col = (SELECT …)`)
- [ ] `EXISTS` / `NOT EXISTS`
- [ ] `IN (SELECT …)` / `NOT IN (SELECT …)`
- [ ] `ANY` / `ALL` with subquery
- [ ] Correlated subquery
- [ ] Subquery in FROM (derived table)
- [ ] Subquery in SELECT list

---

## Common Table Expressions (CTEs)

- [ ] `WITH name AS (…) SELECT …`
- [ ] Multiple CTEs (`WITH a AS (…), b AS (…) …`)
- [ ] `WITH RECURSIVE`

---

## Aggregate & GROUP BY

- [x] `GROUP BY col, …`
- [x] `GROUP BY` with expression
- [ ] `GROUP BY ROLLUP (…)`
- [ ] `GROUP BY CUBE (…)`
- [ ] `GROUP BY GROUPING SETS (…)`
- [x] `HAVING <condition>`
- [ ] Filter clause on aggregates: `COUNT(*) FILTER (WHERE …)`

---

## Window Functions

- [ ] `OVER ()` (empty window)
- [ ] `OVER (PARTITION BY …)`
- [ ] `OVER (ORDER BY …)`
- [ ] `OVER (PARTITION BY … ORDER BY …)`
- [ ] Frame specification: `ROWS BETWEEN … AND …` / `RANGE BETWEEN …` / `GROUPS BETWEEN …`
- [ ] Named window: `WINDOW w AS (…)` clause + `OVER w`
- [ ] `FILTER (WHERE …)` on window aggregate

---

## Identifiers & Quoting

- [x] Unquoted identifiers
- [x] Double-quoted identifiers (`"My Table"`)
- [ ] Schema-qualified identifiers beyond two levels (catalog.schema.table)

---

## Comments

- [x] Single-line comments (`-- …`)
- [x] Block comments (`/* … */`)

---

## Miscellaneous

- [ ] Named parameters (`:name`)
- [ ] Prepared statements (unnamed `?` placeholders)

---

## PostgreSQL-Specific

- [ ] `ILIKE` / `NOT ILIKE`
- [ ] `~`, `~*`, `!~`, `!~*` (regex operators)
- [ ] Cast shorthand: `expr::type`
- [ ] `DISTINCT ON (…)`
- [ ] `RETURNING` clause
- [ ] `ON CONFLICT DO NOTHING` / `DO UPDATE SET …` (upsert)
- [ ] `ARRAY[…]` constructor / `ARRAY(SELECT …)`
- [ ] `ANY(array)` / `ALL(array)`
- [ ] Array subscript: `arr[1]`, `arr[1:3]`
- [ ] Array operators: `@>`, `<@`, `&&`
- [ ] JSON/JSONB operators: `->`, `->>`, `#>`, `#>>`, `?`, `?|`, `?&`, `@>`
- [ ] Text-search operators: `@@`, `to_tsvector`, `to_tsquery`
- [ ] `AT TIME ZONE`
- [ ] `GENERATED ALWAYS AS` (computed columns)
- [ ] `FETCH FIRST … ROWS WITH TIES`
- [ ] Dollar-quoted strings (`$$…$$`, `$tag$…$tag$`)
- [ ] Escape strings (`E'…'`)
- [ ] `UNNEST(array)` in FROM
- [ ] `WITH name AS MATERIALIZED (…)` hint
- [ ] Positional parameters (`$1`, `$2`, …)
