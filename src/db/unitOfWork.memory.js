// Unit of Work in-memory: w pamięci nie ma czego cofać, więc runInTransaction po prostu woła fn.
// Seedy można podmienić - unit testy budują w ten sposób własny, mały stan dla każdego testu.
const { createBuildingsRepository } = require("../modules/buildings/buildings.repository.memory");
const { createRoomsRepository } = require("../modules/rooms/rooms.repository.memory");
const { createReservationsRepository } = require("../modules/reservations/reservations.repository.memory");
const { createUsersRepository } = require("../modules/users/users.repository.memory");
const { createAuditLogRepository } = require("../modules/audit/auditLog.repository.memory");

// usersSeed: [{ email, passwordHash, role }] - te same konta co seed bazy (hashe liczy server.js)
// buildingsSeed / roomsSeed / reservationsSeed - undefined = dane domyślne repository
function createMemoryUnitOfWork({ usersSeed = [], buildingsSeed, roomsSeed, reservationsSeed } = {}) {
  const usersRepository = createUsersRepository({ seed: usersSeed });
  // countRooms odwołuje się do roomsRepository leniwie (repository sal powstaje linijkę niżej)
  const buildingsRepository = createBuildingsRepository({ seed: buildingsSeed, countRooms: id => roomsRepository.countByBuilding(id) });
  const roomsRepository = createRoomsRepository({ seed: roomsSeed, buildings: buildingsRepository });
  const reservationsRepository = createReservationsRepository({ seed: reservationsSeed, rooms: roomsRepository, users: usersRepository });

  const auditLogRepository = createAuditLogRepository();

  const repositories = { buildingsRepository, roomsRepository, reservationsRepository, usersRepository, auditLogRepository };

  return { runInTransaction: fn => fn(repositories), repositories };
}

module.exports = { createMemoryUnitOfWork };
