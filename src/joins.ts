import type { ColumnRef, SelectStatement } from "./ast";
import { SanitiseError } from "./errors";
import { Err, Ok } from "./result";
import type { Result } from "./result";

export type Schema = ReturnType<typeof defineSchema>;

export function defineSchema<
  T extends {
    [Table in keyof T]: Record<
      string,
      null | { [FK in keyof T & string]: { ft: FK; fc: keyof T[FK] & string } }[keyof T & string]
    >;
  },
>(schema: T) {
  return schema;
}

export function checkJoins(
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
