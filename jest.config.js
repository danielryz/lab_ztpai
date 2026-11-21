// Konfiguracja Jest - wspólna dla unit i integration.
// setupFiles uruchamia się PRZED każdym plikiem testowym, czyli zanim jakikolwiek moduł wczyta src/config.
module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setupEnv.js"],
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  clearMocks: true
};
