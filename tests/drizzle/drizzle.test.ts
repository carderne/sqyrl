import { expect, test } from "vite-plus/test";

import { defineSchemaFromDrizzle } from "../../src/drizzle.js";
import * as drizzleSchema from "./schema";

test("defineSchemaFromDrizzle converts drizzle schema to agent-sql schema", () => {
  const schema = defineSchemaFromDrizzle(drizzleSchema);

  expect(schema).toEqual({
    user: {
      id: null,
      email: null,
    },
    organization: {
      id: null,
      name: null,
    },
    member: {
      id: null,
      organization_id: { ft: "organization", fc: "id" },
      user_id: { ft: "user", fc: "id" },
    },
    chat: {
      chat: null,
      member_id: { ft: "member", fc: "id" },
    },
    message: {
      id: null,
      chat_id: { ft: "chat", fc: "chat" },
      content: null,
    },
  });
});

test("defineSchemaFromDrizzle excludes excluded tables", () => {
  const schema = defineSchemaFromDrizzle(drizzleSchema, { exclude: ["organization", "user"] });

  expect(schema).toEqual({
    member: {
      id: null,
    },
    chat: {
      chat: null,
      member_id: { ft: "member", fc: "id" },
    },
    message: {
      id: null,
      chat_id: { ft: "chat", fc: "chat" },
      content: null,
    },
  });
});
