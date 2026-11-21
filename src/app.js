const express = require("express");
const swaggerUi = require("swagger-ui-express");
const requestLogger = require("./middleware/requestLogger");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const { createAuthenticate } = require("./middleware/authenticate");
const openapi = require("./docs/openapi");

const { createTokenService } = require("./modules/auth/auth.tokens");
const { createAuthService } = require("./modules/auth/auth.service");
const { createAuthController } = require("./modules/auth/auth.controller");
const { createAuthRouter } = require("./modules/auth/auth.routes");

const { createBuildingsService } = require("./modules/buildings/buildings.service");
const { createBuildingsController } = require("./modules/buildings/buildings.controller");
const { createBuildingsRouter } = require("./modules/buildings/buildings.routes");

const { createRoomsService } = require("./modules/rooms/rooms.service");
const { createRoomsController } = require("./modules/rooms/rooms.controller");
const { createRoomsRouter } = require("./modules/rooms/rooms.routes");

const { createReservationsService } = require("./modules/reservations/reservations.service");
const { createReservationsController } = require("./modules/reservations/reservations.controller");
const { createReservationsRouter } = require("./modules/reservations/reservations.routes");

const { createAuditService, createAdminRouter } = require("./modules/audit/audit.module");
const { createDebugRouter } = require("./modules/debug/debug.routes");
const { noopEventBus } = require("./events/eventBus");

// Buduje aplikację, ale jej NIE uruchamia (brak app.listen) - dzięki temu Supertest testuje ją bez portu.
// config przychodzi z zewnątrz (src/config) - app.js nie czyta process.env.
// eventBus - listenery rejestruje composition root (server.js); domyślnie "pusty" bus.
function createApp({ config, runInTransaction, eventBus = noopEventBus, now = () => new Date() }) {
  const app = express();

  app.use(requestLogger);
  app.use(express.json());

  const tokenService = createTokenService(config.jwt);
  const authenticate = createAuthenticate(tokenService);

  const authService = createAuthService({ runInTransaction, tokenService, bcryptCost: config.bcrypt.cost });
  const buildingsService = createBuildingsService({ runInTransaction });
  const roomsService = createRoomsService({ runInTransaction, now });
  const reservationsService = createReservationsService({ runInTransaction, eventBus, now });
  const auditService = createAuditService({ runInTransaction });

  // --- publiczne: /api/auth/register, /api/auth/login, /api/docs ---
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi, {
    customSiteTitle: "Room Booking API - docs",
    swaggerOptions: { persistAuthorization: true }
  }));
  app.get("/api/docs.json", (req, res) => res.json(openapi));
  // /api/auth/me ma authenticate wewnątrz routera
  app.use("/api/auth", createAuthRouter(createAuthController(authService), { authenticate }));

  // --- wszystko poniżej wymaga tokenu (również nieznane ścieżki: 401 zamiast 404) ---
  app.use(authenticate);

  app.use("/api/buildings", createBuildingsRouter(createBuildingsController(buildingsService)));
  app.use("/api/rooms", createRoomsRouter(createRoomsController(roomsService)));
  app.use("/api/reservations", createReservationsRouter(createReservationsController(reservationsService)));
  app.use("/api/admin", createAdminRouter(auditService));
  app.use("/api/debug", createDebugRouter());

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
