// Unit of Work in-memory: w pamięci nie ma czego cofać, więc runInTransaction po prostu woła fn
const { createBuildingsRepository } = require("../modules/buildings/buildings.repository.memory");
const { createRoomsRepository } = require("../modules/rooms/rooms.repository.memory");
const { createReservationsRepository } = require("../modules/reservations/reservations.repository.memory");

function createMemoryUnitOfWork() {
  // countRooms odwołuje się do roomsRepository leniwie (repository sal powstaje linijkę niżej)
  const buildingsRepository = createBuildingsRepository({ countRooms: id => roomsRepository.countByBuilding(id) });
  const roomsRepository = createRoomsRepository({ buildings: buildingsRepository });
  const reservationsRepository = createReservationsRepository({ rooms: roomsRepository });

  const repositories = { buildingsRepository, roomsRepository, reservationsRepository };

  return { runInTransaction: fn => fn(repositories) };
}

module.exports = { createMemoryUnitOfWork };
