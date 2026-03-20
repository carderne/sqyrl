import { pgTable, text } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id"),
  email: text("email"),
});

export const organization = pgTable("organization", {
  id: text("id"),
  name: text("name"),
});

export const member = pgTable("member", {
  id: text("id"),
  organizationId: text().references(() => organization.id),
  userId: text().references(() => user.id),
});

export const chat = pgTable("chat", {
  id: text("chat"),
  memberId: text("member_id").references(() => member.id),
});

export const message = pgTable("message", {
  id: text("id"),
  chatId: text("chat_id").references(() => chat.id),
  content: text("content"),
});
