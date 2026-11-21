// Pomocnicze funkcje bazy testowej. DATABASE_URL wskazuje już na bazę *_test (tests/setupEnv.js).
const knex = require("knex");
const bcrypt = require("bcryptjs");

// "Od zera, na świeżej i pustej bazie": jeśli bazy testowej jeszcze nie ma - tworzymy ją
// (łączymy się z bazą systemową "postgres" na tym samym serwerze).
async function ensureTestDatabase(url = process.env.DATABASE_URL) {
  const target = new URL(url);
  const dbName = target.pathname.slice(1);
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";

  const admin = knex({ client: "pg", connection: adminUrl.toString(), pool: { min: 0, max: 1 } });
  try {
    const exists = await admin("pg_database").where({ datname: dbName }).first("datname");
    if (!exists) await admin.raw("CREATE DATABASE ??", [dbName]);
  } finally {
    await admin.destroy();
  }
}

// Stan znany przed każdym testem: puste tabele + budynek, 2 sale i konto ADMIN
const ADMIN = { email: "admin@example.com", password: "admin-password-123" };

async function resetDatabase(db) {
  await db.raw("TRUNCATE audit_log, reservations, rooms, buildings, users RESTART IDENTITY CASCADE");
  await db("buildings").insert({ name: "Budynek A", address: "ul. Testowa 1" });            // id 1
  await db("rooms").insert([
    { building_id: 1, name: "101", capacity: 10 },                                         // id 1
    { building_id: 1, name: "102", capacity: 4 }                                           // id 2
  ]);
  await db("users").insert({ email: ADMIN.email, password_hash: await bcrypt.hash(ADMIN.password, 10), role: "ADMIN" }); // id 1
}

module.exports = { ensureTestDatabase, resetDatabase, ADMIN };
