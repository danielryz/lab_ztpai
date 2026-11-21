// Composition root - jedyne miejsce, które tworzy konkretne repositories i woła app.listen()
const { createApp } = require("./app");
const { createRoomsRepository } = require("./modules/rooms/rooms.repository.memory");
const { createReservationsRepository } = require("./modules/reservations/reservations.repository.memory");

const PORT = process.env.PORT || 3000;

const roomsRepository = createRoomsRepository();
const reservationsRepository = createReservationsRepository();

const app = createApp({ roomsRepository, reservationsRepository });

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
