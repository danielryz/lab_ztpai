const { NotFoundError } = require("../../errors/AppError");

// Repository przychodzi z zewnątrz (dependency injection)
function createRoomsService({ roomsRepository }) {
  async function listRooms() {
    return roomsRepository.findAll();
  }

  async function getRoom(id) {
    const room = await roomsRepository.findById(id);
    if (!room) throw new NotFoundError("Room");
    return room;
  }

  return { listRooms, getRoom };
}

module.exports = { createRoomsService };
