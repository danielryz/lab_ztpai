const { uniqueViolation } = require("../../db/memoryErrors");

// Te same dane co seed bazy
const DEFAULT_ROOMS = [
  { id: 1, buildingId: 1, name: "001", capacity: 10 },
  { id: 2, buildingId: 1, name: "102", capacity: 20 },
  { id: 3, buildingId: 1, name: "101", capacity: 30 },
  { id: 4, buildingId: 2, name: "101", capacity: 50 },
  { id: 5, buildingId: 2, name: "201", capacity: 12 }
];

// buildings - repository budynków in-memory (do "JOIN" i sprawdzenia FK)
function createRoomsRepository({ seed = DEFAULT_ROOMS, buildings } = {}) {
  const rooms = structuredClone(seed);
  let nextId = Math.max(0, ...rooms.map(r => r.id)) + 1;

  const withBuilding = room =>
    room ? { ...room, building: { id: room.buildingId, name: buildings?.nameOf(room.buildingId) } } : null;

  return {
    async findAll() {
      return rooms.map(withBuilding);
    },

    async findById(id) {
      return withBuilding(rooms.find(room => room.id === id));
    },

    async findByBuilding(buildingId) {
      return rooms.filter(r => r.buildingId === buildingId).map(withBuilding);
    },

    async create({ buildingId, name, capacity }) {
      if (rooms.some(r => r.buildingId === buildingId && r.name === name)) throw uniqueViolation();
      const room = { id: nextId++, buildingId, name, capacity, createdAt: new Date() };
      rooms.push(room);
      return withBuilding(room);
    },

    async update(id, changes) {
      const room = rooms.find(r => r.id === id);
      if (changes.name && rooms.some(r => r.id !== id && r.buildingId === room.buildingId && r.name === changes.name)) {
        throw uniqueViolation();
      }
      Object.assign(room, Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)));
      return withBuilding(room);
    },

    async delete(id) {
      rooms.splice(rooms.findIndex(r => r.id === id), 1);
    },

    // W pamięci nie ma czego blokować - metoda istnieje dla zgodności interfejsu
    async lockById() {},

    countByBuilding(buildingId) {
      return rooms.filter(r => r.buildingId === buildingId).length;
    }
  };
}

module.exports = { createRoomsRepository };
