// Composition root - jedyne miejsce, które wybiera implementację repositories (Knex / in-memory),
// tworzy event bus i rejestruje listenery, woła app.listen() i obsługuje zamknięcie procesu.
// Konfiguracja wyłącznie z src/config (walidacja Zod przy starcie).
const config = require("./config");
const { createApp } = require("./app");
const { createEventBus } = require("./events/eventBus");
const { registerAuditListeners } = require("./events/auditListeners");
const { registerNotificationListeners } = require("./events/notificationListeners");

async function createUnitOfWork() {
  if (config.db.repository === "memory") {
    // Te same konta co seed bazy (00_users.js), żeby dało się testować bez PostgreSQL
    const { buildSeedUsers } = require("./db/seeds/00_users");
    const { createMemoryUnitOfWork } = require("./db/unitOfWork.memory");
    return { ...createMemoryUnitOfWork({ usersSeed: await buildSeedUsers() }), close: async () => {} };
  }
  const db = require("./db/knex");
  const { createKnexUnitOfWork } = require("./db/unitOfWork.knex");
  return { ...createKnexUnitOfWork(db), close: () => db.destroy() };
}

async function main() {
  const { runInTransaction, close } = await createUnitOfWork();

  const eventBus = createEventBus();
  registerAuditListeners(eventBus, { runInTransaction });
  registerNotificationListeners(eventBus, { runInTransaction });

  const app = createApp({ config, runInTransaction, eventBus });

  // Express 5 przekazuje błąd startu (np. EADDRINUSE) do callbacka - nie wolno go zignorować
  const server = app.listen(config.port, err => {
    if (err) throw err;
    console.log(`Server running on http://localhost:${config.port} (repositories: ${config.db.repository})`);
    console.log(`Swagger UI: http://localhost:${config.port}/api/docs`);
  });

  // Graceful shutdown: docker compose down / orkiestrator wysyła SIGTERM (po 10 s - SIGKILL).
  // server.close() przestaje przyjmować nowe połączenia i czeka na trwające requesty,
  // dopiero potem zamykamy pulę połączeń z bazą.
  let shuttingDown = false;
  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down gracefully...`);

    // Bezpiecznik: gdyby jakiś request wisiał, nie czekamy w nieskończoność
    setTimeout(() => {
      console.error("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, 8000).unref();

    server.close(async err => {
      if (err) console.error("Error while closing HTTP server:", err);
      console.log("HTTP server closed");
      await close();
      console.log("Database connection pool closed. Bye!");
      process.exit(err ? 1 : 0);
    });
    // Połączenia keep-alive bez aktywnego requestu zamykamy od razu (inaczej server.close czekałby na timeout)
    server.closeIdleConnections();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
