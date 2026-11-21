// Composition root - jedyne miejsce, które wybiera implementację repositories (Knex / in-memory)
// i woła app.listen(). Konfiguracja wyłącznie z src/config (walidacja Zod przy starcie).
const config = require("./config");
const { createApp } = require("./app");

async function createUnitOfWork() {
  if (config.db.repository === "memory") {
    // Te same konta co seed bazy (00_users.js), żeby dało się testować bez PostgreSQL
    const { buildSeedUsers } = require("./db/seeds/00_users");
    const { createMemoryUnitOfWork } = require("./db/unitOfWork.memory");
    return createMemoryUnitOfWork({ usersSeed: await buildSeedUsers() });
  }
  const db = require("./db/knex");
  const { createKnexUnitOfWork } = require("./db/unitOfWork.knex");
  return createKnexUnitOfWork(db);
}

async function main() {
  const app = createApp({ config, ...(await createUnitOfWork()) });

  // Express 5 przekazuje błąd startu (np. EADDRINUSE) do callbacka - nie wolno go zignorować
  app.listen(config.port, err => {
    if (err) throw err;
    console.log(`Server running on http://localhost:${config.port} (repositories: ${config.db.repository})`);
    console.log(`Swagger UI: http://localhost:${config.port}/api/docs`);
  });
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
