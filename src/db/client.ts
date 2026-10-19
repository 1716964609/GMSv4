import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function applyMigrationQueries(
  queries: string[],
  databaseUrl = process.env.DATABASE_URL ?? "./data/gmsv4.sqlite"
) {
  mkdirSync(dirname(databaseUrl), { recursive: true });
  const client = new DatabaseSync(databaseUrl);
  try {
    for (const query of queries) {
      client.exec(query);
    }
  } finally {
    client.close();
  }
}

export function createDatabase(databaseUrl = process.env.DATABASE_URL ?? "./data/gmsv4.sqlite") {
  mkdirSync(dirname(databaseUrl), { recursive: true });
  const client = new DatabaseSync(databaseUrl);

  return drizzle(async (sql, params, method) => {
    const statement = client.prepare(sql);
    const values = params as any[];

    if (method === "run") {
      statement.run(...values);
      return { rows: [] };
    }

    const result = statement.all(...values) as Array<Record<string, unknown>>;
    const rows = result.map((row) => Object.values(row));

    if (method === "get") {
      return { rows: rows.slice(0, 1) };
    }

    return { rows };
  });
}
