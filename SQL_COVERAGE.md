# SQL Coverage

Tracking PostgreSQL SQL feature coverage in `src/sql.ohm` / `src/ast.ts`.

---

## Top-Level Statement Types

- [x] `SELECT`
- [ ] `INSERT INTO`
- [ ] `UPDATE … SET`
- [ ] `DELETE FROM`
- [ ] `CREATE TABLE`
- [ ] `ALTER TABLE`
- [ ] `DROP TABLE / VIEW / INDEX / …`
- [ ] `CREATE VIEW`
- [ ] `CREATE INDEX`
- [ ] `TRUNCATE`
- [ ] `EXPLAIN / EXPLAIN ANALYZE`
- [ ] `BEGIN / COMMIT / ROLLBACK` (transactions)
- [ ] `GRANT / REVOKE`
- [ ] `CREATE FUNCTION / PROCEDURE`
- [ ] `DO` (anonymous PL/pgSQL block)
- [ ] `COPY`
- [ ] `VACUUM / ANALYZE`
- [ ] `SET / SHOW` (runtime parameters)
- [ ] `WITH … AS (…)` — CTE as a standalone / top-level wrapper

---

## SELECT Clauses

- [x] `SELECT <columns>`
- [x] `FROM <table>`
- [x] `WHERE`
- [x] `LIMIT`
- [ ] `DISTINCT` / `DISTINCT ON (…)`
- [ ] `JOIN` (see JOIN section below)
- [ ] `GROUP BY`
- [ ] `HAVING`
- [ ] `ORDER BY` (including `ASC` / `DESC` / `NULLS FIRST` / `NULLS LAST`)
- [ ] `OFFSET`
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
- [ ] Expressions / arithmetic: `a + b`, `a - b`, `a * b`, `a / b`, `a % b`, `a ^ b`
- [ ] Unary minus: `-expr`
- [ ] String concatenation: `a || b`
- [ ] Function calls: `count(*)`, `coalesce(a, b)`, `now()`, `lower(col)`, …
- [ ] Aggregate functions: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`
- [ ] `DISTINCT` inside aggregates: `COUNT(DISTINCT col)`
- [ ] Window functions: `ROW_NUMBER() OVER (…)`, `RANK()`, `LAG()`, …
- [ ] `OVER (PARTITION BY … ORDER BY … ROWS/RANGE …)`
- [ ] `CASE WHEN … THEN … ELSE … END`
- [ ] `CAST(expr AS type)` / `expr::type`
- [ ] Subquery in SELECT list (scalar subquery)
- [ ] `ARRAY[…]` constructor
- [ ] Row constructor: `ROW(a, b, c)`
- [ ] Type literals: `INTERVAL '1 day'`, `DATE '2024-01-01'`, …

---

## Literals & Types

- [x] String literals (`'…'`)
- [x] Integer literals
- [ ] Float / decimal literals (`3.14`, `1e5`)
- [ ] Boolean literals (`TRUE` / `FALSE`)
- [ ] `NULL`
- [ ] Dollar-quoted strings (`$$…$$`, `$tag$…$tag$`)
- [ ] Escape strings (`E'…'`)
- [ ] Unicode strings (`U&'…'`)
- [ ] Byte literals (`'\x…'`, `B'…'`)
- [ ] Numeric with sign (`+1`, `-1`)

---

## FROM Clause

- [x] Simple table reference
- [x] Schema-qualified table (`schema.table`)
- [x] Table alias (`AS` and implicit)
- [ ] Multiple tables (comma-separated, implicit cross join)
- [ ] Subquery in FROM: `(SELECT …) AS alias`
- [ ] Lateral subquery: `LATERAL (…) AS alias`
- [ ] `TABLESAMPLE` (e.g. `TABLESAMPLE BERNOULLI(10)`)
- [ ] `UNNEST(array)` in FROM
- [ ] `VALUES (…), (…)` as a table
- [ ] Table functions / `ROWS FROM (…)`

---

## JOIN Types

- [ ] `[INNER] JOIN … ON …`
- [ ] `LEFT [OUTER] JOIN … ON …`
- [ ] `RIGHT [OUTER] JOIN … ON …`
- [ ] `FULL [OUTER] JOIN … ON …`
- [ ] `CROSS JOIN`
- [ ] `NATURAL JOIN`
- [ ] `JOIN … USING (col, …)`
- [ ] Multiple sequential joins
- [ ] Self-join

---

## WHERE / Filter Expressions

- [x] Equality: `col = 'value'`
- [x] `AND`
- [x] `OR`
- [x] Parenthesised grouping
- [ ] `NOT`
- [ ] Inequality: `<>`, `!=`
- [ ] Comparison: `<`, `>`, `<=`, `>=`
- [ ] `IS NULL` / `IS NOT NULL`
- [ ] `IS TRUE` / `IS FALSE` / `IS UNKNOWN`
- [ ] `BETWEEN … AND …` / `NOT BETWEEN`
- [ ] `IN (…)` list / `NOT IN (…)`
- [ ] `IN (subquery)` / `NOT IN (subquery)`
- [ ] `LIKE` / `NOT LIKE`
- [ ] `ILIKE` / `NOT ILIKE` (case-insensitive, PostgreSQL)
- [ ] `SIMILAR TO`
- [ ] `~`, `~*`, `!~`, `!~*` (regex operators)
- [ ] `EXISTS (subquery)`
- [ ] `ANY` / `ALL` / `SOME` (subquery comparisons)
- [ ] `DISTINCT FROM` / `NOT DISTINCT FROM`
- [ ] Arithmetic expressions on either side of comparisons
- [ ] Function calls in comparisons
- [ ] Right-hand side column reference (col = col)
- [ ] Right-hand side integer / boolean / NULL literals

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
- [ ] Materialised hint: `WITH name AS MATERIALIZED (…)`
- [ ] CTE used in INSERT / UPDATE / DELETE

---

## Aggregate & GROUP BY

- [ ] `GROUP BY col, …`
- [ ] `GROUP BY` with expression
- [ ] `GROUP BY ROLLUP (…)`
- [ ] `GROUP BY CUBE (…)`
- [ ] `GROUP BY GROUPING SETS (…)`
- [ ] `HAVING <condition>`
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

## PostgreSQL-Specific Operators & Features

- [ ] Cast shorthand: `expr::type`
- [ ] Array subscript: `arr[1]`, `arr[1:3]`
- [ ] Array operators: `@>`, `<@`, `&&`, `||`
- [ ] JSON/JSONB operators: `->`, `->>`, `#>`, `#>>`, `@>`, `<@`, `?`, `?|`, `?&`
- [ ] `jsonb_path_query` / `@@` (jsonpath)
- [ ] `ARRAY[…]` literal / `ARRAY(SELECT …)`
- [ ] `ANY(array)` / `ALL(array)`
- [ ] Range types and operators (`@>`, `<@`, `&&`, …)
- [ ] `OVERLAPS`
- [ ] `AT TIME ZONE`
- [ ] Geometric operators
- [ ] Text-search operators: `@@`, `to_tsvector`, `to_tsquery`
- [ ] `RETURNING` clause on INSERT / UPDATE / DELETE
- [ ] `ON CONFLICT` (upsert): `DO NOTHING` / `DO UPDATE SET …`
- [ ] `GENERATED ALWAYS AS` (computed columns)
- [ ] `FETCH FIRST … ROWS WITH TIES`

---

## Data Definition (DDL)

- [ ] `CREATE TABLE (col type constraints, …)`
- [ ] Column constraints: `NOT NULL`, `UNIQUE`, `PRIMARY KEY`, `DEFAULT`, `CHECK`, `REFERENCES`
- [ ] Table constraints: `PRIMARY KEY (…)`, `UNIQUE (…)`, `CHECK (…)`, `FOREIGN KEY … REFERENCES …`
- [ ] `CREATE TABLE … AS SELECT …` (CTAS)
- [ ] `CREATE TABLE … LIKE …`
- [ ] `CREATE TEMP / TEMPORARY TABLE`
- [ ] `CREATE UNLOGGED TABLE`
- [ ] `ALTER TABLE ADD COLUMN`
- [ ] `ALTER TABLE DROP COLUMN`
- [ ] `ALTER TABLE ALTER COLUMN`
- [ ] `ALTER TABLE ADD CONSTRAINT`
- [ ] `ALTER TABLE RENAME`
- [ ] `DROP TABLE [IF EXISTS]`
- [ ] `CREATE INDEX [CONCURRENTLY]`
- [ ] `CREATE UNIQUE INDEX`
- [ ] Partial index: `CREATE INDEX … WHERE …`
- [ ] Expression index
- [ ] `DROP INDEX`
- [ ] `CREATE VIEW`
- [ ] `CREATE MATERIALIZED VIEW`
- [ ] `REFRESH MATERIALIZED VIEW`
- [ ] `CREATE SCHEMA`
- [ ] `CREATE SEQUENCE`
- [ ] `CREATE TYPE` (enum, composite, domain)
- [ ] `CREATE EXTENSION`

---

## Data Manipulation (DML)

- [ ] `INSERT INTO … VALUES (…)`
- [ ] `INSERT INTO … SELECT …`
- [ ] `INSERT INTO … (col, …) VALUES (…)`
- [ ] Multi-row `VALUES`
- [ ] `RETURNING`
- [ ] `ON CONFLICT DO NOTHING`
- [ ] `ON CONFLICT (col) DO UPDATE SET …`
- [ ] `UPDATE … SET col = expr WHERE …`
- [ ] `UPDATE … SET col = expr FROM … WHERE …` (join-based update)
- [ ] `DELETE FROM … WHERE …`
- [ ] `DELETE … USING … WHERE …`

---

## Identifiers & Quoting

- [x] Unquoted identifiers
- [ ] Double-quoted identifiers (`"My Table"`)
- [ ] Case-insensitive keyword matching (partial — only keywords defined in grammar)
- [ ] Schema-qualified identifiers beyond two levels (catalog.schema.table)

---

## Comments

- [x] Single-line comments (`-- …`)
- [ ] Block comments (`/* … */`)

---

## Miscellaneous

- [ ] Multiple statements separated by `;`
- [ ] `RETURNING` clause
- [ ] Prepared statements / `$1` positional parameters
- [ ] Named parameters (`:name`)
- [ ] `LISTEN` / `NOTIFY`
- [ ] `LOCK TABLE`
- [ ] `CALL` (stored procedures)
- [ ] `MERGE` (PostgreSQL 15+)
