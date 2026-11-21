// Uruchamiany przy starcie kontenera (CMD w Dockerfile): wykonuje migracje i wypisuje, które zostały zastosowane.
const db = require("./knex");

async function main() {
  const [batch, applied] = await db.migrate.latest();
  if (applied.length === 0) {
    console.log("[migrate] Database schema is up to date - no new migrations");
  } else {
    console.log(`[migrate] Batch ${batch} - applied ${applied.length} migration(s):`);
    for (const name of applied) console.log(`[migrate]   ${name}`);
  }
  await db.destroy();
}

main().catch(async err => {
  console.error("[migrate] Migration failed:", err.message);
  await db.destroy();
  process.exit(1);
});
