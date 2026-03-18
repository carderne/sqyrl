## Objective

Time to implement some of the missing features from SQL_COVERAGE.md.

We ONLY want to support SELECT clauses for now. The focus is on making a secure system where
we can insert a WHERE clause that cannot be bypassed. So we don't want to support CTEs,
subqueries etc yet.

Focus on the simpler parts of SELECT causes, column expressions, joins, where clauses etc.
The normal useful stuff. Each time you're about to start another thing, re-scan SQL_COVERAGE.md
and see if there's something higher priority to support.

Prefer implementing a single feature at a time, unless there's clearly a benefit to implementing a few together.

## Process

For each feature(s) that you decide to work on, this is the process:

1. Add support to src/sql.ohm.
2. Run `vp gen:types`
3. Add new AST items to src/ast.ts. Make it as structured as possible. Eg `alias` isn't just an optional string, it's a separate type that knows how to handle itself ("AS" prefix). Where sensible, you can add a second level `kind` field as used eg in ColumnExpr to distinguish. In the future we may decide to make these fields more nested, for now they are quite flat.
4. Add support for the ohm -> ast process to src/parse.ts.
5. Add support for the new AST types to src/output.ts. Make sure the new types are added to the ASTNode enum.
6. Add 1-2 tests (no more) to tests/features.test.ts validating the full loop works for that language feature.
7. Run `vp check --fix` and `vp test`.
8. Tick off the features from SQL_COVERAGE.md
9. Commit the changes with a short commit message `support xyz feature`

## Notes

Be as token efficient as possible, since you'll be running for a while.
