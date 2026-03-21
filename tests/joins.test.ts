import { expect, test, describe } from "vite-plus/test";

import { checkJoinContinuity, checkJoinColumns, defineSchema } from "../src/joins";
import { parseSql } from "../src/parse";

// ============================================================
// checkJoinColumns — schema-based join column validation
// ============================================================

const schema = defineSchema({
  org: { id: null },
  user: { id: null, org_id: { ft: "org", fc: "id" } },
  message: { id: null, user_id: { ft: "user", fc: "id" } },
  key: { id: null, org_id: { ft: "org", fc: "id" } },
});

describe("checkJoinColumns", () => {
  // --- valid cases ---

  test("valid join on declared FK passes", () => {
    const ast = parseSql("SELECT * FROM message JOIN user ON user.id = message.user_id").unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(true);
  });

  test("valid join with FK columns in reversed order passes", () => {
    const ast = parseSql("SELECT * FROM message JOIN user ON message.user_id = user.id").unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(true);
  });

  test("valid multi-hop join chain passes", () => {
    const ast = parseSql(
      `SELECT * FROM message
       JOIN user ON user.id = message.user_id
       JOIN org ON org.id = user.org_id`,
    ).unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(true);
  });

  test("no joins is valid with schema", () => {
    const ast = parseSql("SELECT * FROM org").unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(true);
  });

  // --- no schema (simple API) ---

  test("no schema and no joins is ok", () => {
    const ast = parseSql("SELECT * FROM orders").unwrap();
    const result = checkJoinColumns(ast, undefined);
    expect(result.ok).toBe(true);
  });

  test("no schema rejects any join", () => {
    const ast = parseSql("SELECT * FROM orders JOIN users ON users.id = orders.user_id").unwrap();
    const result = checkJoinColumns(ast, undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("No joins allowed");
    }
  });

  // --- table not in schema ---

  test("rejects FROM table not in schema", () => {
    const ast = parseSql("SELECT * FROM secret").unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("secret");
      expect(result.error.message).toContain("not allowed");
    }
  });

  test("rejects JOIN table not in schema", () => {
    const ast = parseSql("SELECT * FROM org JOIN secret ON secret.id = org.id").unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("secret");
      expect(result.error.message).toContain("not allowed");
    }
  });

  // --- non column_ref = column_ref ON conditions ---

  test("rejects JOIN ON boolean literal (ON true)", () => {
    const ast = parseSql("SELECT * FROM message JOIN org ON true").unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Only JOIN ON column_ref = column_ref supported");
    }
  });

  test("rejects JOIN ON integer literal", () => {
    const ast = parseSql("SELECT * FROM message JOIN org ON 1 = 1").unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Only JOIN ON column_ref = column_ref supported");
    }
  });

  test("rejects JOIN ON column = string literal", () => {
    const ast = parseSql("SELECT * FROM message JOIN org ON org.id = 'abc'").unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Only JOIN ON column_ref = column_ref supported");
    }
  });

  test("rejects JOIN ON with non-equality operator", () => {
    const ast = parseSql("SELECT * FROM message JOIN user ON user.id > message.user_id").unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Only JOIN ON column_ref = column_ref supported");
    }
  });

  test("rejects JOIN ON with compound AND condition", () => {
    const ast = parseSql(
      "SELECT * FROM message JOIN user ON user.id = message.user_id AND user.org_id = message.id",
    ).unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Only JOIN ON column_ref = column_ref supported");
    }
  });

  test("rejects CROSS JOIN (null condition)", () => {
    const ast = parseSql("SELECT * FROM message CROSS JOIN org").unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Only JOIN ON column_ref = column_ref supported");
    }
  });

  test("rejects NATURAL JOIN (null condition)", () => {
    const ast = parseSql("SELECT * FROM message NATURAL JOIN org").unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Only JOIN ON column_ref = column_ref supported");
    }
  });

  // --- wrong columns / wrong FK target ---

  test("rejects join on column not declared in schema", () => {
    // org.created_at is not a column in the schema definition for org
    const ast = parseSql(
      "SELECT * FROM message JOIN org ON org.created_at = message.created_at",
    ).unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("org.created_at");
    }
  });

  test("rejects join referencing undeclared column on the join table", () => {
    // user.email is not in the schema
    const ast = parseSql(
      "SELECT * FROM message JOIN user ON user.email = message.user_id",
    ).unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("user.email");
    }
  });

  test("rejects join where FK points to wrong foreign table", () => {
    // user.org_id is declared as FK to org.id, not to key.id
    const ast = parseSql("SELECT * FROM user JOIN key ON user.org_id = key.id").unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("key");
    }
  });

  test("rejects join where FK points to wrong foreign column", () => {
    // user.org_id → org.id is valid, but user.org_id → org.org_id is not
    // (org doesn't have org_id as an FK target that user.org_id points to)
    const ast = parseSql("SELECT * FROM user JOIN org ON user.org_id = org.org_id").unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(false);
  });

  test("rejects join referencing a table not in the schema on foreign side", () => {
    // message.user_id FK goes to user.id, not to phantom.id
    const ast = parseSql("SELECT * FROM message JOIN user ON user.id = phantom.user_id").unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(false);
  });

  test("rejects join with null-column FK reversed against non-FK foreign", () => {
    // org.id is null (no FK), so when org is the joining table and id is the
    // joining column, it checks the foreign side. message.id has no FK pointing
    // back to org.id.
    const ast = parseSql("SELECT * FROM message JOIN org ON org.id = message.id").unwrap();
    const result = checkJoinColumns(ast, schema);
    expect(result.ok).toBe(false);
  });
});

// ============================================================
// checkJoinContinuity — graph connectivity validation
// ============================================================

// === CONNECTED (valid) queries ===

test("single table (no joins) is trivially connected", () => {
  const ast = parseSql("SELECT * FROM message").unwrap();
  const result = checkJoinContinuity(ast);
  expect(result.ok).toBe(true);
});

test("correct query: all tables connected in a single component", () => {
  // From the spec: message ↔ user ↔ org ↔ key
  const ast = parseSql(
    `SELECT body
     FROM message
     JOIN user ON user.id = message.user_id
     JOIN org ON org.id = user.org_id
     JOIN key ON key.org_id = org.id
     WHERE org.id = 1`,
  ).unwrap();
  const result = checkJoinContinuity(ast);
  expect(result.ok).toBe(true);
});

test("two tables with a valid join are connected", () => {
  const ast = parseSql("SELECT * FROM orders JOIN users ON orders.user_id = users.id").unwrap();
  const result = checkJoinContinuity(ast);
  expect(result.ok).toBe(true);
});

test("returns the ast unchanged on success", () => {
  const ast = parseSql("SELECT * FROM orders JOIN users ON orders.user_id = users.id").unwrap();
  const result = checkJoinContinuity(ast);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.data).toBe(ast);
  }
});

// === DISCONNECTED (invalid) queries — from the spec ===

test("spec example: unconnected table (message has no ON reference)", () => {
  // message is never referenced in any ON clause.
  // key ↔ org are connected to each other but not to message.
  // BFS starts from message (the FROM table), so key and org are unreachable.
  const ast = parseSql(
    `SELECT body
     FROM message
     JOIN key ON key.org_id = org.id
     JOIN org ON key.org_id = org.id
     WHERE org.id = 1`,
  ).unwrap();
  const result = checkJoinContinuity(ast);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.message).toContain("key");
    expect(result.error.message).toContain("org");
  }
});

test("spec example: two disconnected clusters", () => {
  // {message ↔ user} and {org ↔ key} — no edge between clusters
  const ast = parseSql(
    `SELECT body
     FROM message
     JOIN user ON user.id = message.user_id
     JOIN org ON org.id = key.org_id
     JOIN key ON key.org_id = org.id
     WHERE org.id = 1`,
  ).unwrap();
  const result = checkJoinContinuity(ast);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    // org and key are disconnected from message+user
    expect(result.error.message).toContain("key");
    expect(result.error.message).toContain("org");
  }
});

// === Edge case: self-referencing ON ===

test("self-referencing ON does not create an edge to other tables", () => {
  // key only references itself in the ON clause — no connection to message
  const ast = parseSql(
    `SELECT * FROM message
     JOIN key ON key.org_id = key.id`,
  ).unwrap();
  const result = checkJoinContinuity(ast);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.message).toContain("key");
  }
});

// === Edge case: CROSS JOIN (no condition) ===

test("CROSS JOIN with no ON clause is disconnected", () => {
  const ast = parseSql(
    `SELECT * FROM message
     CROSS JOIN key`,
  ).unwrap();
  const result = checkJoinContinuity(ast);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.message).toContain("key");
  }
});

// === Edge case: one connected join + one disconnected ===

test("mix of connected and disconnected joins", () => {
  const ast = parseSql(
    `SELECT *
     FROM message
     JOIN user ON user.id = message.user_id
     JOIN key ON key.org_id = key.id`,
  ).unwrap();
  const result = checkJoinContinuity(ast);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.message).toContain("key");
  }
});

// === Edge case: compound ON conditions (AND) ===

test("compound ON with AND connecting two tables is valid", () => {
  const ast = parseSql(
    `SELECT *
     FROM message
     JOIN user ON user.id = message.user_id AND user.org_id = message.org_id`,
  ).unwrap();
  const result = checkJoinContinuity(ast);
  expect(result.ok).toBe(true);
});

// === Edge case: ON referencing a column without a table qualifier ===

test("unqualified column refs in ON do not count as edges", () => {
  // If a column ref has no table qualifier, we can't determine which table it
  // belongs to, so it must not be treated as creating an edge. This is the
  // conservative / security-safe choice.
  const ast = parseSql(
    `SELECT *
     FROM message
     JOIN key ON org_id = key.id`,
  ).unwrap();
  const result = checkJoinContinuity(ast);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    // message is the FROM table and is the start of BFS.
    // key is only connected to "key" (itself) via the qualified ref.
    // The unqualified org_id creates no edge, so key is disconnected.
    expect(result.error.message).toContain("key");
  }
});

// === Edge case: same table appears in FROM and JOIN (self-join by name) ===

test("same table name in FROM and JOIN is trivially connected", () => {
  // This is a degenerate case — same name means only one node in the graph
  const ast = parseSql(
    `SELECT *
     FROM message
     JOIN message ON message.id = message.parent_id`,
  ).unwrap();
  const result = checkJoinContinuity(ast);
  expect(result.ok).toBe(true);
});

// === Edge case: three tables, chain connected ===

test("chain of three tables: a ↔ b ↔ c", () => {
  const ast = parseSql(
    `SELECT *
     FROM a
     JOIN b ON b.a_id = a.id
     JOIN c ON c.b_id = b.id`,
  ).unwrap();
  const result = checkJoinContinuity(ast);
  expect(result.ok).toBe(true);
});

// === Edge case: ON condition references table not in query ===

test("ON referencing a table not in the query does not create a spurious edge", () => {
  // key.org_id = phantom.id — phantom is not in FROM/JOINs,
  // so this should not connect key to anything
  const ast = parseSql(
    `SELECT *
     FROM message
     JOIN key ON key.org_id = phantom.id`,
  ).unwrap();
  const result = checkJoinContinuity(ast);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.message).toContain("key");
  }
});

// === Error message format ===

test("error message lists all disconnected tables sorted", () => {
  const ast = parseSql(
    `SELECT *
     FROM a
     JOIN z ON z.id = z.parent_id
     JOIN m ON m.id = m.parent_id`,
  ).unwrap();
  const result = checkJoinContinuity(ast);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    // m and z are both disconnected from a, should be sorted
    expect(result.error.message).toContain("m, z");
  }
});

// === LEFT / RIGHT / FULL joins also checked ===

test("LEFT JOIN with valid ON is connected", () => {
  const ast = parseSql(
    `SELECT *
     FROM message
     LEFT JOIN user ON user.id = message.user_id`,
  ).unwrap();
  const result = checkJoinContinuity(ast);
  expect(result.ok).toBe(true);
});

test("LEFT JOIN with self-referencing ON is disconnected", () => {
  const ast = parseSql(
    `SELECT *
     FROM message
     LEFT JOIN key ON key.org_id = key.id`,
  ).unwrap();
  const result = checkJoinContinuity(ast);
  expect(result.ok).toBe(false);
});
