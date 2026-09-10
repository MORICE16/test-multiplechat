import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const items = sqliteTable("morice_items", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), kind: text("kind").notNull(), title: text("title").notNull(), content: text("content").notNull().default(""), status: text("status").notNull().default("open"), priority: text("priority").notNull().default("normal"), position: integer("position").notNull().default(0), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});
export const settings = sqliteTable("morice_settings", { userId: text("user_id").notNull(), key: text("key").notNull(), value: text("value").notNull() }, table => [primaryKey({ columns: [table.userId, table.key] })]);
export const pushSubscriptions = sqliteTable("morice_push_subscriptions", { endpoint: text("endpoint").primaryKey(), userId: text("user_id").notNull(), p256dh: text("p256dh").notNull().default(""), auth: text("auth").notNull().default(""), createdAt: text("created_at").notNull() });
export const systemValues = sqliteTable("morice_system", { key: text("key").primaryKey(), value: text("value").notNull() });
export const connections = sqliteTable("morice_connections", {
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: text("expires_at").notNull(),
  accountEmail: text("account_email").notNull().default(""),
  scopes: text("scopes").notNull().default(""),
  status: text("status").notNull().default("connected"),
  updatedAt: text("updated_at").notNull(),
}, table => [primaryKey({ columns: [table.userId, table.provider] })]);
export const actionPayloads = sqliteTable("morice_action_payloads", {
  itemId: text("item_id").primaryKey(),
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(),
  operation: text("operation").notNull(),
  payload: text("payload").notNull(),
  result: text("result").notNull().default(""),
  createdAt: text("created_at").notNull(),
  executedAt: text("executed_at"),
});
