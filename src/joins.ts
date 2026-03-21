import type { ColumnRef, SelectStatement, WhereExpr, WhereValue } from "./ast";
import { SanitiseError } from "./errors";
import { Err, Ok } from "./result";
import type { Result } from "./result";

export type Schema = ReturnType<typeof defineSchema>;

export function defineSchema<
  // TODO this needs to also support specifying a schema/namespace
  T extends {
    [Table in keyof T]: Record<
      string,
      null | { [FK in keyof T & string]: { ft: FK; fc: keyof T[FK] & string } }[keyof T & string]
    >;
  },
>(schema: T) {
  return schema;
}

export function validateJoins(
  ast: SelectStatement,
  schema: Schema | undefined,
): Result<SelectStatement> {
  const ast2 = checkJoinColumns(ast, schema);
  if (!ast2.ok) return ast2;
  const res = checkJoinContinuity(ast);
  return res;
}

export function checkJoinColumns(
  ast: SelectStatement,
  schema: Schema | undefined,
): Result<SelectStatement> {
  if (schema === undefined) {
    if (ast.joins.length > 0) {
      return Err(new SanitiseError("No joins allowed when using simple API without schema."));
    }
    // The FROM table will be checked against the WhereGuard in `addWhereGuard`.
    return Ok(ast);
  }

  if (!(ast.from.table.name in schema)) {
    return Err(new SanitiseError(`Table ${ast.from.table.name} is not allowed`));
  }

  for (const join of ast.joins) {
    const joinSettings = schema[join.table.name];
    if (joinSettings === undefined) {
      // The join table does not appear in the table definitions
      return Err(new SanitiseError(`Table ${join.table.name} is not allowed`));
    }
    // These are all JOIN expressions that are not currently supported,
    // but could be supported in feature once they can be guaranteed to be safe
    if (
      join.condition === null ||
      join.condition.type === "join_using" ||
      join.condition.expr.type !== "where_comparison" ||
      join.condition.expr.operator !== "=" ||
      join.condition.expr.left.type !== "where_value" ||
      join.condition.expr.left.kind !== "column_ref" ||
      join.condition.expr.right.type !== "where_value" ||
      join.condition.expr.right.kind !== "column_ref"
    ) {
      return Err(new SanitiseError("Only JOIN ON column_ref = column_ref supported"));
    }

    // At this point we know we have a single ON clause
    // That is either ON thisTable.foreignId = foreignTable.id
    // or             ON foreignTable.id = thisTable.foreignId
    // So we must:
    // 1. See which side (left or right) has the foreign table
    // 2. Check whether that table is a valid join target for this table
    // 3. Check whether the correct column is used

    const { joining, foreign } = getJoinTableRef(
      join.table.name,
      join.condition.expr.left.ref,
      join.condition.expr.right.ref,
    );

    // Now we have joining ref and foreign ref well specified
    // Check that the joining ref uses a permitted column name
    const joinTableCol = joinSettings[joining.name];
    if (joinTableCol === undefined) {
      return Err(new SanitiseError(`Tried to join using ${join.table.name}.${joining.name}`));
    }

    if (joinTableCol === null) {
      const foreignTableSettings = schema[foreign.table!];
      if (foreignTableSettings === undefined) {
        return Err(new SanitiseError(`Table ${foreign.name} is not allowed`));
      }
      const foreignCol = foreignTableSettings[foreign.name];
      if (foreignCol === undefined || foreignCol === null) {
        return Err(new SanitiseError(`Tried to join using ${foreign.table}.${foreign.name}`));
      }
      if (joining.table !== foreignCol.ft || joining.name !== foreignCol.fc) {
        return Err(new SanitiseError(`Tried to join using ${joining.table}.${joining.name}`));
      }
    } else {
      // Now we can check whether foreign matches the allowed
      if (foreign.table !== joinTableCol.ft || foreign.name !== joinTableCol.fc) {
        return Err(new SanitiseError(`Tried to join using ${foreign.table}.${foreign.name}`));
      }
    }
  }

  return Ok(ast);
}

function getJoinTableRef(joinTableName: string, left: ColumnRef, right: ColumnRef) {
  if (left.table === joinTableName) {
    return { joining: left, foreign: right };
  }
  return { joining: right, foreign: left };
}

/**
 * Validates that all tables in the query's FROM/JOIN clauses form a single
 * connected component via the ON predicates. A disconnected table would produce
 * an implicit cross product which can leak data across tenants.
 *
 * Returns the AST unchanged if valid, or a SanitiseError listing the
 * disconnected tables.
 */
export function checkJoinContinuity(ast: SelectStatement): Result<SelectStatement> {
  if (ast.joins.length === 0) {
    // Single table, trivially connected.
    return Ok(ast);
  }

  // 1. Collect all table names from FROM + JOINs
  const tables = new Set<string>();
  tables.add(ast.from.table.name);
  for (const join of ast.joins) {
    tables.add(join.table.name);
  }

  // If there's only one distinct table name (self-joins), trivially connected.
  if (tables.size <= 1) {
    return Ok(ast);
  }

  // 2. Build adjacency from ON conditions
  const adjacency = new Map<string, Set<string>>();
  for (const table of tables) {
    adjacency.set(table, new Set());
  }

  for (const join of ast.joins) {
    if (join.condition === null) {
      // CROSS JOIN / NATURAL JOIN — no ON predicate, no edge.
      continue;
    }

    if (join.condition.type === "join_using") {
      // USING connects the joined table to other tables that share those columns.
      // We cannot determine from column names alone which tables are connected,
      // but USING implicitly references the join table and the preceding table(s).
      // Since this is security-critical, we do NOT assume connectivity for USING —
      // it would need to be validated separately. However, checkJoins already
      // rejects USING before this function runs. If this function is called
      // independently, treat USING as not providing a provable edge.
      continue;
    }

    // join_on: extract column references from the ON expression
    const referencedTables = new Set<string>();
    collectTableRefsFromExpr(join.condition.expr, referencedTables);

    // Only keep references to tables that are actually in the query
    const relevantTables: string[] = [];
    for (const t of referencedTables) {
      if (tables.has(t)) {
        relevantTables.push(t);
      }
    }

    // Create edges between all pairs of referenced tables
    for (let i = 0; i < relevantTables.length; i++) {
      for (let j = i + 1; j < relevantTables.length; j++) {
        adjacency.get(relevantTables[i]!)!.add(relevantTables[j]!);
        adjacency.get(relevantTables[j]!)!.add(relevantTables[i]!);
      }
    }
  }

  // 3. BFS from the FROM table to check full connectivity
  const start = ast.from.table.name;
  const visited = new Set<string>();
  const queue: string[] = [start];
  visited.add(start);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  if (visited.size === tables.size) {
    return Ok(ast);
  }

  // Find which tables are disconnected
  const disconnected: string[] = [];
  for (const table of tables) {
    if (!visited.has(table)) {
      disconnected.push(table);
    }
  }
  disconnected.sort();

  return Err(
    new SanitiseError(
      `Disconnected table(s) in query: ${disconnected.join(", ")}. All tables must be connected via JOIN ON predicates.`,
    ),
  );
}

/** Recursively collect table names from column references in a WhereExpr. */
function collectTableRefsFromExpr(expr: WhereExpr, out: Set<string>): void {
  switch (expr.type) {
    case "where_and":
    case "where_or":
      collectTableRefsFromExpr(expr.left, out);
      collectTableRefsFromExpr(expr.right, out);
      break;
    case "where_not":
      collectTableRefsFromExpr(expr.expr, out);
      break;
    case "where_comparison":
      collectTableRefsFromValue(expr.left, out);
      collectTableRefsFromValue(expr.right, out);
      break;
    case "where_is_null":
      collectTableRefsFromValue(expr.expr, out);
      break;
    case "where_is_bool":
      collectTableRefsFromValue(expr.expr, out);
      break;
    case "where_between":
      collectTableRefsFromValue(expr.expr, out);
      collectTableRefsFromValue(expr.low, out);
      collectTableRefsFromValue(expr.high, out);
      break;
    case "where_in":
      collectTableRefsFromValue(expr.expr, out);
      for (const v of expr.list) {
        collectTableRefsFromValue(v, out);
      }
      break;
    case "where_like":
      collectTableRefsFromValue(expr.expr, out);
      collectTableRefsFromValue(expr.pattern, out);
      break;
    case "where_ts_match":
      collectTableRefsFromValue(expr.left, out);
      collectTableRefsFromValue(expr.right, out);
      break;
  }
}

/** Recursively collect table names from column references in a WhereValue. */
function collectTableRefsFromValue(val: WhereValue, out: Set<string>): void {
  switch (val.type) {
    case "where_value":
      if (val.kind === "column_ref" && val.ref.table) {
        out.add(val.ref.table);
      } else if (val.kind === "func_call") {
        if (val.func.args.kind === "args") {
          for (const arg of val.func.args.args) {
            collectTableRefsFromValue(arg, out);
          }
        }
      }
      // string, integer, float, bool, null — no table refs
      break;
    case "where_arith":
    case "where_jsonb_op":
    case "where_pgvector_op":
      collectTableRefsFromValue(val.left, out);
      collectTableRefsFromValue(val.right, out);
      break;
    case "where_unary_minus":
      collectTableRefsFromValue(val.expr, out);
      break;
    case "case_expr":
      if (val.subject) {
        collectTableRefsFromValue(val.subject, out);
      }
      for (const w of val.whens) {
        collectTableRefsFromValue(w.condition, out);
        collectTableRefsFromValue(w.result, out);
      }
      if (val.else) {
        collectTableRefsFromValue(val.else, out);
      }
      break;
    case "cast_expr":
      collectTableRefsFromValue(val.expr, out);
      break;
  }
}
