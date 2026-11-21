const { NotFoundError, ConflictError } = require("../../errors/AppError");

function createBuildingsService({ runInTransaction }) {
  async function findOrFail(buildingsRepository, id) {
    const building = await buildingsRepository.findById(id);
    if (!building) throw new NotFoundError("Building");
    return building;
  }

  async function listBuildings() {
    return runInTransaction(({ buildingsRepository }) => buildingsRepository.findAll());
  }

  async function getBuilding(id) {
    return runInTransaction(({ buildingsRepository }) => findOrFail(buildingsRepository, id));
  }

  async function createBuilding(input) {
    // Duplikat nazwy -> UNIQUE w bazie (23505) -> 409 w error handlerze
    return runInTransaction(({ buildingsRepository }) => buildingsRepository.create(input));
  }

  async function updateBuilding(id, changes) {
    return runInTransaction(async ({ buildingsRepository }) => {
      await findOrFail(buildingsRepository, id);
      return buildingsRepository.update(id, changes);
    });
  }

  async function deleteBuilding(id) {
    return runInTransaction(async ({ buildingsRepository }) => {
      const building = await findOrFail(buildingsRepository, id);
      // Czytelny błąd zamiast samego FK RESTRICT (który i tak zostaje jako zabezpieczenie w bazie)
      if (building.roomsCount > 0) {
        throw new ConflictError("Building still has rooms and cannot be deleted", "BUILDING_HAS_ROOMS");
      }
      await buildingsRepository.delete(id);
    });
  }

  async function listBuildingRooms(id) {
    return runInTransaction(async ({ buildingsRepository, roomsRepository }) => {
      await findOrFail(buildingsRepository, id);
      return roomsRepository.findByBuilding(id);
    });
  }

  return { listBuildings, getBuilding, createBuilding, updateBuilding, deleteBuilding, listBuildingRooms };
}

module.exports = { createBuildingsService };
