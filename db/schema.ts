import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const items = sqliteTable("morice_items", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), kind: text("kind").notNull(), title: text("title").notNull(), content: text("content").notNull().default(""), status: text("status").notNull().default("open"), priority: text("priority").notNull().default("normal"), position: integer("position").notNull().default(0), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});
export const settings = sqliteTable("morice_settings", { userId: text("user_id").notNull(), key: text("key").notNull(), value: text("value").notNull() }, table => [primaryKey({ columns: [table.userId, table.key] })]);
export const pushSubscriptions = sqliteTable("morice_push_subscriptions", { endpoint: text("endpoint").primaryKey(), userId: text("user_id").notNull(), p256dh: text("p256dh").notNull().default(""), auth: text("auth").notNull().default(""), createdAt: text("created_at").notNull() });
export const systemValues = sqliteTable("morice_system", { key: text("key").primaryKey(), value: text("value").notNull() });
