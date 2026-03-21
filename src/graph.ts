import type { JoinClause, SelectStatement } from "./ast";
import { SanitiseError } from "./errors";
import type { GuardCol, GuardVal, WhereGuard } from "./guard";
import { type Schema } from "./joins";
import { Err, Ok, type Result } from "./result";

export type WhereGuardAliases = GuardCol & {
  value: GuardVal;
  aliases: GuardCol[];
};
/*
 * TODO: Not used currently, as resolveGuardJoins achieves the same thing
 * in a more useful way.
 * Use the supplied schema to find equivalent table.column pairs as those supplied in the guards.
 *
 * Eg with this schema:
 * {
 *   org: { id: null },
 *   user: { org_id: { ft: "org", fc: "id" } },
 * }
 *
 * And this guard: { "org.id": 1 }
 *
 * Will resolve "user.org_id" as an alias.
 */

export function resolveGuardAliases(
  schema: Schema,
  guards: WhereGuard[],
): Result<WhereGuardAliases[]> {
  const res: WhereGuardAliases[] = [];

  for (const guard of guards) {
    const table = (schema as Record<string, Record<string, unknown>>)[guard.table];
    if (!table || !(guard.column in table)) {
      return Err(new SanitiseError(`Guard references unknown ${guard.table}.${guard.column}`));
    }

    const aliases: GuardCol[] = [];
    for (const [tName, cols] of Object.entries(schema as Record<string, Record<string, unknown>>)) {
      for (const [cName, def] of Object.entries(cols)) {
        if (def && typeof def === "object" && "ft" in def && "fc" in def) {
          if (def.ft === guard.table && def.fc === guard.column) {
            aliases.push({ table: tName, column: cName });
          }
        }
      }
    }

    res.push({ ...guard, aliases });
  }

  return Ok(res);
}

export function insertNeededGuardJoins(
  ast: SelectStatement,
  schema: Schema | undefined,
  guards: WhereGuard[],
  autoJoin: boolean,
): Result<SelectStatement> {
  if (schema === undefined) {
    return Ok(ast);
  }
  if (!autoJoin) {
    return Ok(ast);
  }

  return resolveGraphForJoins(ast, schema, guards);
}

/*
 * Auto-add JOINs so that guard tables are reachable from the query's FROM/JOIN tables.
 *
 * E.g. with schema: org.id ← user.org_id ← message.user_id
 * Query: SELECT * FROM message, guard: org.id = 1
 * Adds:  JOIN user ON user.id = message.user_id
 *        JOIN org  ON org.id  = user.org_id
 */
function resolveGraphForJoins(
  ast: SelectStatement,
  schema: Schema,
  guards: WhereGuard[],
): Result<SelectStatement> {
  const haveTables = new Set<string>();
  haveTables.add(ast.from.table.name);
  for (const join of ast.joins) {
    haveTables.add(join.table.name);
  }

  const adj = buildAdjacency(schema);
  const newJoins: JoinClause[] = [];

  for (const guard of guards) {
    if (haveTables.has(guard.table)) continue;

    const path = bfsPath(adj, haveTables, guard.table);
    if (path === null) {
      return Err(
        new SanitiseError(`No join path from query tables to guard table '${guard.table}'`),
      );
    }

    // Walk the path, adding each new intermediate/target table
    let current = [...haveTables].find(
      (t) => path[0] && (path[0].tableA === t || path[0].tableB === t),
    )!;
    for (const edge of path) {
      const neighbor = edge.tableA === current ? edge.tableB : edge.tableA;
      if (!haveTables.has(neighbor)) {
        newJoins.push(edgeToJoin(edge, neighbor));
        haveTables.add(neighbor);
      }
      current = neighbor;
    }
  }

  if (newJoins.length === 0) return Ok(ast);
  return Ok({ ...ast, joins: [...ast.joins, ...newJoins] });
}

interface Edge {
  tableA: string;
  colA: string;
  tableB: string;
  colB: string;
}

type AdjacencyMap = Map<string, Edge[]>;

function buildAdjacency(schema: Schema): AdjacencyMap {
  const adj: AdjacencyMap = new Map();
  const tables = schema as Record<string, Record<string, unknown>>;

  for (const [tableName, cols] of Object.entries(tables)) {
    if (!adj.has(tableName)) adj.set(tableName, []);
    for (const [colName, def] of Object.entries(cols)) {
      if (def && typeof def === "object" && "ft" in def && "fc" in def) {
        const edge: Edge = {
          tableA: tableName,
          colA: colName,
          tableB: def.ft as string,
          colB: def.fc as string,
        };
        adj.get(tableName)!.push(edge);
        if (!adj.has(edge.tableB)) adj.set(edge.tableB, []);
        adj.get(edge.tableB)!.push(edge);
      }
    }
  }

  return adj;
}

// BFS from any table in `startTables` to `target`, returns the path as edges
function bfsPath(adj: AdjacencyMap, startTables: Set<string>, target: string): Edge[] | null {
  if (startTables.has(target)) return [];

  const visited = new Set<string>(startTables);
  // Each queue entry: [currentTable, edges taken to get here]
  const queue: [string, Edge[]][] = [];
  for (const t of startTables) {
    queue.push([t, []]);
  }

  while (queue.length > 0) {
    const [current, path] = queue.shift()!;
    for (const edge of adj.get(current) ?? []) {
      const neighbor = edge.tableA === current ? edge.tableB : edge.tableA;
      if (visited.has(neighbor)) {
        continue;
      }
      visited.add(neighbor);
      const newPath = [...path, edge];
      if (neighbor === target) {
        return newPath;
      }
      queue.push([neighbor, newPath]);
    }
  }

  return null;
}

function edgeToJoin(edge: Edge, fromTable: string): JoinClause {
  // Orient the ON clause so `fromTable` side is the FK holder
  const [localTable, localCol, foreignTable, foreignCol] =
    edge.tableA === fromTable
      ? [edge.tableA, edge.colA, edge.tableB, edge.colB]
      : [edge.tableB, edge.colB, edge.tableA, edge.colA];

  return {
    type: "join",
    joinType: "inner",
    table: { type: "table_ref", name: localTable },
    condition: {
      type: "join_on",
      expr: {
        type: "where_comparison",
        operator: "=",
        left: {
          type: "where_value",
          kind: "column_ref",
          ref: { type: "column_ref", table: localTable, name: localCol },
        },
        right: {
          type: "where_value",
          kind: "column_ref",
          ref: { type: "column_ref", table: foreignTable, name: foreignCol },
        },
      },
    },
  };
}
