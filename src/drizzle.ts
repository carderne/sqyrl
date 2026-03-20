import { getTableName, isTable, type Table, type TableConfig } from "drizzle-orm";

import type { Schema } from "./joins";

/** Extract all table name strings from a drizzle schema module. */
type TableNames<T> = {
  [K in keyof T]: T[K] extends Table<infer C extends TableConfig> ? C["name"] : never;
}[keyof T];

/**
 * Convert a camelCase string to snake_case.
 * This matches drizzle-orm's internal conversion for columns without explicit DB names.
 */
function camelToSnake(input: string): string {
  const words =
    input.replace(/['\u2019]/g, "").match(/[\da-z]+|[A-Z]+(?![a-z])|[A-Z][\da-z]+/g) ?? [];
  return words.map((w) => w.toLowerCase()).join("_");
}

/** Get the DB column name, applying camelCase → snake_case when the key was used as name. */
function getDbColumnName(col: { name: string; keyAsName: boolean }): string {
  return col.keyAsName ? camelToSnake(col.name) : col.name;
}

// Well-known drizzle symbols
const ColumnsSymbol = Symbol.for("drizzle:Columns");
const InlineForeignKeysSymbol = Symbol.for("drizzle:PgInlineForeignKeys");

interface DrizzleColumn {
  name: string;
  keyAsName: boolean;
  table: Table;
}

interface DrizzleForeignKey {
  reference: () => {
    columns: DrizzleColumn[];
    foreignTable: Table;
    foreignColumns: DrizzleColumn[];
  };
}

/**
 * Build an agent-sql schema from a drizzle-orm schema module.
 *
 * Usage:
 * ```ts
 * import * as drizzleSchema from "./schema";
 * const schema = defineSchemaFromDrizzle(drizzleSchema);
 * ```
 */
export function defineSchemaFromDrizzle<T extends Record<string, unknown>>(
  drizzleSchema: T,
  { exclude }: { exclude?: TableNames<T>[] } = {},
): Schema {
  const schema: Record<string, Record<string, null | { ft: string; fc: string }>> = {};
  const excluded = new Set<string>(exclude);

  // Collect all non-excluded tables from the module exports
  const tables: Table[] = [];
  for (const value of Object.values(drizzleSchema)) {
    if (isTable(value) && !excluded.has(getTableName(value))) {
      tables.push(value);
    }
  }

  // Build per-table FK info from inline foreign keys
  // For each column, store either the resolved FK or "excluded" if it points to an excluded table
  const fkMap = new Map<string, Map<string, { ft: string; fc: string } | "excluded">>();

  for (const table of tables) {
    const tableName = getTableName(table);
    const fks: DrizzleForeignKey[] =
      ((table as unknown as Record<symbol, unknown>)[InlineForeignKeysSymbol] as
        | DrizzleForeignKey[]
        | undefined) ?? [];

    const colFks = new Map<string, { ft: string; fc: string } | "excluded">();
    for (const fk of fks) {
      const ref = fk.reference();
      const fromCol = ref.columns[0]!;
      const foreignTableName = getTableName(ref.foreignTable);
      if (excluded.has(foreignTableName)) {
        colFks.set(getDbColumnName(fromCol), "excluded");
      } else {
        const toCol = ref.foreignColumns[0]!;
        colFks.set(getDbColumnName(fromCol), {
          ft: foreignTableName,
          fc: getDbColumnName(toCol),
        });
      }
    }
    fkMap.set(tableName, colFks);
  }

  // Build the schema object
  for (const table of tables) {
    const tableName = getTableName(table);
    const columns: DrizzleColumn[] = Object.values(
      (table as unknown as Record<symbol, unknown>)[ColumnsSymbol] as Record<string, DrizzleColumn>,
    );
    const colFks = fkMap.get(tableName)!;
    const tableSchema: Record<string, null | { ft: string; fc: string }> = {};

    for (const col of columns) {
      const dbName = getDbColumnName(col);
      const fk = colFks.get(dbName);
      // Drop columns whose FK points to an excluded table
      if (fk === "excluded") continue;
      tableSchema[dbName] = fk ?? null;
    }

    schema[tableName] = tableSchema;
  }

  return schema as Schema;
}
