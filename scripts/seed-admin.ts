/**
 * Seed default admin into SQLite document store.
 * Email: admin@scormcreator.local  Password: Admin@123
 *
 * Usage: npx tsx scripts/seed-admin.ts
 */
import { ensureDefaultAdmin } from "../src/lib/auth/ensure-admin";
import { sqliteFilePath } from "../src/lib/store";

async function main() {
  const user = await ensureDefaultAdmin();
  console.log("Admin ready:");
  console.log(`  email:    ${user.email}`);
  console.log(`  password: Admin@123`);
  console.log(`  sqlite:   ${sqliteFilePath()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
