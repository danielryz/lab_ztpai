// Konfiguracja Knex (CLI: migrate / seed oraz aplikacja).
// Nie czyta process.env - wszystko przychodzi z modułu src/config.
const config = require("./src/config");

module.exports = {
  client: "pg",
  connection: config.db.url,
  migrations: { directory: "./src/db/migrations" },
  seeds: { directory: "./src/db/seeds" }
};
