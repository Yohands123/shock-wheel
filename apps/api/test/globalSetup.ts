import { execSync } from "node:child_process";

export default function setup() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Integration tests need DATABASE_URL or TEST_DATABASE_URL (run `pnpm db:up` first)");
  }
  // The run below wipes the schema, so refuse anything that isn't clearly a test database
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) {
    throw new Error(
      `Refusing to reset database "${dbName}": integration tests only run against a database whose name ends in "_test". ` +
        `Set TEST_DATABASE_URL (e.g. postgresql://shock:shock@localhost:5432/shock_test).`,
    );
  }
  // Fresh schema for every test run (prisma db push creates the database if it doesn't exist)
  execSync("npx prisma db push --force-reset --skip-generate", { stdio: "inherit" });
}
