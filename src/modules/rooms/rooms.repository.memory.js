// Jedyne miejsce, w którym istnieją dane sal (tablica w pamięci)
const DEFAULT_ROOMS = [
  { id: 1, name: "A101", capacity: 30 },
  { id: 2, name: "A102", capacity: 20 },
  { id: 3, name: "B201", capacity: 50 },
  { id: 4, name: "C301", capacity: 10 }
];

function createRoomsRepository(seed = DEFAULT_ROOMS) {
  const rooms = structuredClone(seed);

  return {
    async findAll() {
      return rooms;
    },

    async findById(id) {
      return rooms.find(room => room.id === id) ?? null;
    }
  };
}

module.exports = { createRoomsRepository };
