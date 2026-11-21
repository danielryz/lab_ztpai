// Composition root - jedyne miejsce, które wybiera implementację repositories (Knex / in-memory)
// i woła app.listen()
try {
  process.loadEnvFile();
} catch {
  // brak pliku .env - zmienne mogą przyjść z zewnątrz
}

const { createApp } = require("./app");

const PORT = process.env.PORT || 3000;
const REPOSITORY = process.env.REPOSITORY || "knex";

function createUnitOfWork() {
  if (REPOSITORY === "memory") {
    const { createMemoryUnitOfWork } = require("./db/unitOfWork.memory");
    return createMemoryUnitOfWork();
  }
  const db = require("./db/knex");
  const { createKnexUnitOfWork } = require("./db/unitOfWork.knex");
  return createKnexUnitOfWork(db);
}

const app = createApp(createUnitOfWork());

// Express 5 przekazuje błąd startu (np. EADDRINUSE) do callbacka - nie wolno go zignorować
app.listen(PORT, err => {
  if (err) throw err;
  console.log(`Server running on http://localhost:${PORT} (repositories: ${REPOSITORY})`);
});
