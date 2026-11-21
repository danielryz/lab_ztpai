const { uniqueViolation } = require("../../db/memoryErrors");

const DEFAULT_BUILDINGS = [
  { id: 1, name: "Budynek A", address: "ul. Warszawska 24, Kraków", createdAt: new Date("2026-10-01T08:00:00Z") },
  { id: 2, name: "Budynek B", address: "ul. Podchorążych 2, Kraków", createdAt: new Date("2026-10-01T08:00:00Z") },
  { id: 3, name: "Budynek C", address: "ul. Krótka 1, Kraków", createdAt: new Date("2026-10-01T08:00:00Z") }
];

// countRooms(buildingId) dostarcza unit of work (in-memory "JOIN" z salami)
function createBuildingsRepository({ seed = DEFAULT_BUILDINGS, countRooms = () => 0 } = {}) {
  const buildings = structuredClone(seed);
  let nextId = Math.max(0, ...buildings.map(b => b.id)) + 1;

  const withCount = b => (b ? { ...b, roomsCount: countRooms(b.id) } : null);

  return {
    async findAll() {
      return buildings.map(withCount);
    },

    async findById(id) {
      return withCount(buildings.find(b => b.id === id));
    },

    async create({ name, address }) {
      if (buildings.some(b => b.name === name)) throw uniqueViolation();
      const building = { id: nextId++, name, address, createdAt: new Date() };
      buildings.push(building);
      return withCount(building);
    },

    async update(id, changes) {
      const building = buildings.find(b => b.id === id);
      if (changes.name && buildings.some(b => b.id !== id && b.name === changes.name)) throw uniqueViolation();
      Object.assign(building, Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)));
      return withCount(building);
    },

    async delete(id) {
      buildings.splice(buildings.findIndex(b => b.id === id), 1);
    },

    // używane przez repository sal (sprawdzenie FK)
    exists(id) {
      return buildings.some(b => b.id === id);
    },

    nameOf(id) {
      return buildings.find(b => b.id === id)?.name;
    }
  };
}

module.exports = { createBuildingsRepository };
