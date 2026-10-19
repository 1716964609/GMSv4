import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { applyMigrationQueries, createDatabase } from "./client";

async function main() {
  const database = createDatabase();
  await migrate(database, async (queries) => applyMigrationQueries(queries), {
    migrationsFolder: "./drizzle"
  });
  console.log("Database migrations applied.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
