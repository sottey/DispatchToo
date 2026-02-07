import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * Creates a fresh in-memory SQLite database with the full schema.
 * Returns the Drizzle client instance.
 */
export function createTestDb() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });

  // Create all tables matching the schema
  sqlite.exec(`
    CREATE TABLE "user" (
      "id" text PRIMARY KEY NOT NULL,
      "name" text,
      "email" text,
      "emailVerified" integer,
      "image" text
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email");

    CREATE TABLE "account" (
      "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "type" text NOT NULL,
      "provider" text NOT NULL,
      "providerAccountId" text NOT NULL,
      "refresh_token" text,
      "access_token" text,
      "expires_at" integer,
      "token_type" text,
      "scope" text,
      "id_token" text,
      "session_state" text,
      PRIMARY KEY ("provider", "providerAccountId")
    );

    CREATE TABLE "session" (
      "sessionToken" text PRIMARY KEY NOT NULL,
      "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "expires" integer NOT NULL
    );

    CREATE TABLE "task" (
      "id" text PRIMARY KEY NOT NULL,
      "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "title" text NOT NULL,
      "description" text,
      "status" text NOT NULL DEFAULT 'open',
      "priority" text NOT NULL DEFAULT 'medium',
      "dueDate" text,
      "createdAt" text NOT NULL DEFAULT (current_timestamp),
      "updatedAt" text NOT NULL DEFAULT (current_timestamp)
    );

    CREATE INDEX "task_userId_idx" ON "task" ("userId");
    CREATE INDEX "task_status_idx" ON "task" ("status");
    CREATE INDEX "task_priority_idx" ON "task" ("priority");

    CREATE TABLE "note" (
      "id" text PRIMARY KEY NOT NULL,
      "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "title" text NOT NULL,
      "content" text,
      "createdAt" text NOT NULL DEFAULT (current_timestamp),
      "updatedAt" text NOT NULL DEFAULT (current_timestamp)
    );

    CREATE INDEX "note_userId_idx" ON "note" ("userId");

    CREATE TABLE "dispatch" (
      "id" text PRIMARY KEY NOT NULL,
      "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "date" text NOT NULL,
      "summary" text,
      "finalized" integer NOT NULL DEFAULT 0,
      "createdAt" text NOT NULL DEFAULT (current_timestamp),
      "updatedAt" text NOT NULL DEFAULT (current_timestamp)
    );

    CREATE INDEX "dispatch_userId_idx" ON "dispatch" ("userId");
    CREATE INDEX "dispatch_date_idx" ON "dispatch" ("userId", "date");

    CREATE TABLE "dispatch_task" (
      "dispatchId" text NOT NULL REFERENCES "dispatch"("id") ON DELETE CASCADE,
      "taskId" text NOT NULL REFERENCES "task"("id") ON DELETE CASCADE,
      PRIMARY KEY ("dispatchId", "taskId")
    );
  `);

  return { db, sqlite };
}
