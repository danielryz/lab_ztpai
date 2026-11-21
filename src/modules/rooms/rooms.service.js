const { NotFoundError, ConflictError } = require("../../errors/AppError");

// Repositories przychodzą z zewnątrz przez runInTransaction (Unit of Work)
function createRoomsService({ runInTransaction, now = () => new Date() }) {
  async function findOrFail(roomsRepository, id) {
    const room = await roomsRepository.findById(id);
    if (!room) throw new NotFoundError("Room");
    return room;
  }

  async function listRooms() {
    return runInTransaction(({ roomsRepository }) => roomsRepository.findAll());
  }

  async function getRoom(id) {
    return runInTransaction(({ roomsRepository }) => findOrFail(roomsRepository, id));
  }

  async function createRoom(input) {
    return runInTransaction(async ({ buildingsRepository, roomsRepository }) => {
      const building = await buildingsRepository.findById(input.buildingId);
      if (!building) throw new NotFoundError("Building");

      // Duplikat nazwy w budynku -> UNIQUE (building_id, name) w bazie -> 23505 -> 409
      return roomsRepository.create(input);
    });
  }

  async function updateRoom(id, changes) {
    return runInTransaction(async ({ roomsRepository, reservationsRepository }) => {
      await findOrFail(roomsRepository, id);

      if (changes.capacity !== undefined) {
        // Ta sama blokada co przy tworzeniu rezerwacji - nikt w tym czasie nie zarezerwuje sali
        await roomsRepository.lockById(id);
        const upcoming = (await reservationsRepository.findByRoomAndStatus(id, "CONFIRMED"))
          .filter(r => new Date(r.endTime).getTime() > now().getTime());
        const tooBig = upcoming.find(r => r.participants > changes.capacity);
        if (tooBig) {
          throw new ConflictError(
            `Capacity ${changes.capacity} is lower than participants of upcoming reservation ${tooBig.id} (${tooBig.participants})`,
            "CAPACITY_BELOW_RESERVATIONS"
          );
        }
      }

      return roomsRepository.update(id, changes);
    });
  }

  async function deleteRoom(id) {
    return runInTransaction(async ({ roomsRepository, reservationsRepository }) => {
      await findOrFail(roomsRepository, id);
      // Rezerwacje to historia - sali z rezerwacjami nie usuwamy (w bazie dodatkowo FK RESTRICT)
      if (await reservationsRepository.existsForRoom(id)) {
        throw new ConflictError("Room has reservations and cannot be deleted", "ROOM_HAS_RESERVATIONS");
      }
      await roomsRepository.delete(id);
    });
  }

  return { listRooms, getRoom, createRoom, updateRoom, deleteRoom };
}

module.exports = { createRoomsService };
