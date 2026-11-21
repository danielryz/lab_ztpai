// Jedyne miejsce, które zna tabelę "rooms" i jej kolumny.
// Sala zawsze jest zwracana razem z budynkiem (JOIN - jedno zapytanie, brak N+1).
function toRoom(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    buildingId: row.building_id,
    building: { id: row.building_id, name: row.building_name },
    createdAt: row.created_at
  };
}

function createRoomsRepository(db) {
  function withBuilding() {
    return db("rooms as r")
      .join("buildings as b", "b.id", "r.building_id")
      .select("r.id", "r.name", "r.capacity", "r.building_id", "r.created_at", "b.name as building_name");
  }

  return {
    async findAll() {
      const rows = await withBuilding().orderBy("r.id", "asc");
      return rows.map(toRoom);
    },

    async findById(id) {
      return toRoom(await withBuilding().where("r.id", id).first());
    },

    async findByBuilding(buildingId) {
      const rows = await withBuilding().where("r.building_id", buildingId).orderBy("r.id", "asc");
      return rows.map(toRoom);
    },

    async create({ buildingId, name, capacity }) {
      const [{ id }] = await db("rooms")
        .insert({ building_id: buildingId, name, capacity })
        .returning("id");
      return this.findById(id);
    },

    // SELECT ... FOR UPDATE - blokada wiersza sali do końca transakcji
    async lockById(id) {
      await db("rooms").where({ id }).forUpdate().first("id");
    }
  };
}

module.exports = { createRoomsRepository };
