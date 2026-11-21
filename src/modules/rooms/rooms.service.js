const { NotFoundError } = require("../../errors/AppError");

// Repositories przychodzą z zewnątrz przez runInTransaction (Unit of Work)
function createRoomsService({ runInTransaction }) {
  async function listRooms() {
    return runInTransaction(({ roomsRepository }) => roomsRepository.findAll());
  }

  async function getRoom(id) {
    return runInTransaction(async ({ roomsRepository }) => {
      const room = await roomsRepository.findById(id);
      if (!room) throw new NotFoundError("Room");
      return room;
    });
  }

  async function createRoom(input) {
    return runInTransaction(async ({ buildingsRepository, roomsRepository }) => {
      const building = await buildingsRepository.findById(input.buildingId);
      if (!building) throw new NotFoundError("Building");

      // Duplikat nazwy w budynku -> UNIQUE (building_id, name) w bazie -> 23505 -> 409
      return roomsRepository.create(input);
    });
  }

  return { listRooms, getRoom, createRoom };
}

module.exports = { createRoomsService };
