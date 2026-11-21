// Jedyne miejsce, które zna tabelę "buildings" i jej kolumny
function toBuilding(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    roomsCount: row.rooms_count,
    createdAt: row.created_at
  };
}

function createBuildingsRepository(db) {
  // LEFT JOIN + GROUP BY: budynek bez sal też się pojawi (roomsCount = 0). Jedno zapytanie - brak N+1.
  function withRoomsCount() {
    return db("buildings as b")
      .leftJoin("rooms as r", "r.building_id", "b.id")
      .groupBy("b.id")
      .select("b.id", "b.name", "b.address", "b.created_at", db.raw("count(r.id)::int as rooms_count"));
  }

  return {
    async findAll() {
      const rows = await withRoomsCount().orderBy("b.id", "asc");
      return rows.map(toBuilding);
    },

    async findById(id) {
      return toBuilding(await withRoomsCount().where("b.id", id).first());
    },

    async create({ name, address }) {
      const [row] = await db("buildings").insert({ name, address }).returning("*");
      return toBuilding({ ...row, rooms_count: 0 });
    },

    async update(id, { name, address }) {
      await db("buildings").where({ id }).update({ name, address }); // undefined = kolumna pominięta
      return this.findById(id);
    },

    async delete(id) {
      await db("buildings").where({ id }).del();
    }
  };
}

module.exports = { createBuildingsRepository };
