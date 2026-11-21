const { NotFoundError } = require("../../errors/AppError");

function createBuildingsService({ runInTransaction }) {
  async function listBuildings() {
    return runInTransaction(({ buildingsRepository }) => buildingsRepository.findAll());
  }

  async function getBuilding(id) {
    return runInTransaction(async ({ buildingsRepository }) => {
      const building = await buildingsRepository.findById(id);
      if (!building) throw new NotFoundError("Building");
      return building;
    });
  }

  async function createBuilding(input) {
    // Duplikat nazwy -> UNIQUE w bazie (23505) -> 409 w error handlerze
    return runInTransaction(({ buildingsRepository }) => buildingsRepository.create(input));
  }

  async function listBuildingRooms(id) {
    return runInTransaction(async ({ buildingsRepository, roomsRepository }) => {
      const building = await buildingsRepository.findById(id);
      if (!building) throw new NotFoundError("Building");
      return roomsRepository.findByBuilding(id);
    });
  }

  return { listBuildings, getBuilding, createBuilding, listBuildingRooms };
}

module.exports = { createBuildingsService };
