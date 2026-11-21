// Seed użytkowników. Konto ADMIN powstaje tylko tutaj - przez API nie da się go utworzyć.
// Hasła nie są zapisane w repozytorium - pochodzą z .env (SEED_ADMIN_PASSWORD, SEED_USER_PASSWORD).
const bcrypt = require("bcryptjs");
const config = require("../../config");

// Te same konta są używane przez repository in-memory (REPOSITORY=memory)
const SEED_USERS = [
  { email: null, role: "ADMIN" },                         // id 1 - email z SEED_ADMIN_EMAIL
  { email: "jan.kowalski@example.com", role: "USER" },    // id 2
  { email: "anna.nowak@example.com", role: "USER" },      // id 3
  { email: "piotr.wisniewski@example.com", role: "USER" },// id 4
  { email: "maria.zielinska@example.com", role: "USER" }  // id 5
];

async function buildSeedUsers() {
  const { adminEmail, adminPassword, userPassword } = config.seed;
  if (!adminEmail || !adminPassword || !userPassword) {
    throw new Error("Set SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD and SEED_USER_PASSWORD in .env before seeding");
  }

  const [adminHash, userHash] = await Promise.all([
    bcrypt.hash(adminPassword, config.bcrypt.cost),
    bcrypt.hash(userPassword, config.bcrypt.cost)
  ]);

  return SEED_USERS.map(u => u.role === "ADMIN"
    ? { email: adminEmail, passwordHash: adminHash, role: u.role }
    : { email: u.email, passwordHash: userHash, role: u.role });
}

exports.buildSeedUsers = buildSeedUsers;

exports.seed = async function (knex) {
  const users = await buildSeedUsers();

  // CASCADE czyści też reservations (FK user_id) - seed 01 wstawia je od nowa
  await knex.raw("TRUNCATE users RESTART IDENTITY CASCADE");

  await knex("users").insert(users.map(u => ({ email: u.email, password_hash: u.passwordHash, role: u.role })));
};
