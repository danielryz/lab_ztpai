// Unit of Work na Knex: runInTransaction uruchamia fn w transakcji i podaje repositories
// powiązane z tą transakcją (trx ma to samo API co db).
const { createBuildingsRepository } = require("../modules/buildings/buildings.repository.knex");
const { createRoomsRepository } = require("../modules/rooms/rooms.repository.knex");
const { createReservationsRepository } = require("../modules/reservations/reservations.repository.knex");
const { createUsersRepository } = require("../modules/users/users.repository.knex");
const { createAuditLogRepository } = require("../modules/audit/auditLog.repository.knex");

function createKnexRepositories(db) {
  return {
    buildingsRepository: createBuildingsRepository(db),
    roomsRepository: createRoomsRepository(db),
    reservationsRepository: createReservationsRepository(db),
    usersRepository: createUsersRepository(db),
    auditLogRepository: createAuditLogRepository(db)
  };
}

function createKnexUnitOfWork(db) {
  return {
    runInTransaction: fn => db.transaction(trx => fn(createKnexRepositories(trx)))
  };
}

module.exports = { createKnexRepositories, createKnexUnitOfWork };
