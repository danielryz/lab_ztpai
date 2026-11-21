const express = require("express");
const requestLogger = require("./middleware/requestLogger");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const { createRoomsService } = require("./modules/rooms/rooms.service");
const { createRoomsController } = require("./modules/rooms/rooms.controller");
const { createRoomsRouter } = require("./modules/rooms/rooms.routes");

const { createReservationsService } = require("./modules/reservations/reservations.service");
const { createReservationsController } = require("./modules/reservations/reservations.controller");
const { createReservationsRouter } = require("./modules/reservations/reservations.routes");

const { createDebugRouter } = require("./modules/debug/debug.routes");

// Buduje aplikację, ale jej NIE uruchamia (brak app.listen)
function createApp({ roomsRepository, reservationsRepository, now = () => new Date() }) {
  const app = express();

  app.use(requestLogger);
  app.use(express.json());

  const roomsService = createRoomsService({ roomsRepository });
  const reservationsService = createReservationsService({ roomsRepository, reservationsRepository, now });

  app.use("/api/rooms", createRoomsRouter(createRoomsController(roomsService)));
  app.use("/api/reservations", createReservationsRouter(createReservationsController(reservationsService)));
  app.use("/api/debug", createDebugRouter());

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
