// Uruchamiany przez Jest (setupFiles) przed KAŻDYM plikiem testowym - zanim jakikolwiek moduł wczyta src/config.
// process.loadEnvFile() w src/config nie nadpisuje zmiennych już ustawionych, więc testy zawsze dostaną
// bazę testową, nawet jeśli w .env jest baza developerska.
try {
  process.loadEnvFile(); // TEST_DATABASE_URL może być w .env (lokalnie); w CI przychodzi z env workflow
} catch {
  // brak .env - np. w CI
}

process.env.NODE_ENV = "test";
process.env.REPOSITORY = "knex";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://room_booking:change-me-db-password@localhost:5435/room_booking_test";
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123";
process.env.JWT_EXPIRES_IN = "15m";
process.env.BCRYPT_COST = "10"; // minimum dopuszczane przez config - szybsze testy

// Bezpiecznik: testy integracyjne robią TRUNCATE. Nigdy nie mogą trafić w bazę developerską.
const dbName = new URL(process.env.DATABASE_URL).pathname.slice(1);
if (!dbName.endsWith("_test")) {
  throw new Error(`Refusing to run tests on database "${dbName}" - test database name must end with "_test"`);
}
