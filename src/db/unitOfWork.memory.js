// Unit of Work in-memory: w pamięci nie ma czego cofać, więc runInTransaction po prostu woła fn
const { createBuildingsRepository } = require("../modules/buildings/buildings.repository.memory");
const { createRoomsRepository } = require("../modules/rooms/rooms.repository.memory");
const { createReservationsRepository } = require("../modules/reservations/reservations.repository.memory");
const { createUsersRepository } = require("../modules/users/users.repository.memory");

// usersSeed: [{ email, passwordHash, role }] - te same konta co seed bazy (hashe liczy server.js)
function createMemoryUnitOfWork({ usersSeed = [] } = {}) {
  const usersRepository = createUsersRepository({ seed: usersSeed });
  // countRooms odwołuje się do roomsRepository leniwie (repository sal powstaje linijkę niżej)
  const buildingsRepository = createBuildingsRepository({ countRooms: id => roomsRepository.countByBuilding(id) });
  const roomsRepository = createRoomsRepository({ buildings: buildingsRepository });
  const reservationsRepository = createReservationsRepository({ rooms: roomsRepository, users: usersRepository });

  const repositories = { buildingsRepository, roomsRepository, reservationsRepository, usersRepository };

  return { runInTransaction: fn => fn(repositories) };
}

module.exports = { createMemoryUnitOfWork };
